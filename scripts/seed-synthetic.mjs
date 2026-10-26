#!/usr/bin/env node
/**
 * Load synthetic users into a Neon (or local Postgres) database.
 * Never points at prod Supabase. Refuses URLs that look like supabase.co.
 *
 *   DATABASE_URL=postgresql://… node scripts/seed-synthetic.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
if (/supabase\.co/i.test(url)) {
  console.error('Refusing to seed a supabase.co URL. This script is synthetic-only.')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schema = readFileSync(join(root, 'worker/schema/0001_init.sql'), 'utf8')
const seed = readFileSync(join(root, 'worker/schema/isolation-seed.sql'), 'utf8')

const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1|\[::1\]/.test(url) ? false : 'require' })
try {
  await sql.unsafe(schema)
  await sql.unsafe(seed)
  const users = await sql`SELECT email FROM "user" ORDER BY email`
  console.log(`seeded ${users.length} synthetic users: ${users.map((u) => u.email).join(', ')}`)
} finally {
  await sql.end({ timeout: 2 })
}
