#!/usr/bin/env node
/**
 * Load synthetic users into a Neon (or local Postgres) database.
 * Never points at prod Supabase. Refuses URLs that look like supabase.co.
 *
 *   DATABASE_URL=postgresql://… node scripts/seed-synthetic.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
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

function connectionHostname(connectionString) {
  try {
    return new URL(connectionString).hostname || null
  } catch {
    return null
  }
}

function isLoopbackHostname(hostname) {
  const host = String(hostname ?? '').replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '::1') return true
  try {
    const canonical = new URL(`http://${host.includes(':') ? `[${host}]` : host}`).hostname
    return canonical === '127.0.0.1' || canonical.startsWith('127.')
  } catch {
    return false
  }
}

function postgresSslOption(connectionString) {
  try {
    const mode = new URL(connectionString).searchParams.get('sslmode')?.toLowerCase()
    if (mode === 'disable') return false
    if (mode === 'require' || mode === 'verify-ca' || mode === 'verify-full') return 'require'
  } catch {
    // fall through
  }
  const host = connectionHostname(connectionString)
  return host && isLoopbackHostname(host) ? false : 'require'
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schemaDir = join(root, 'worker/schema')
const migrations = readdirSync(schemaDir)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort()
  .map((name) => join(schemaDir, name))
const seed = readFileSync(join(schemaDir, 'isolation-seed.sql'), 'utf8')

const sql = postgres(url, { max: 1, ssl: postgresSslOption(url) })
try {
  for (const path of migrations) await sql.unsafe(readFileSync(path, 'utf8'))
  await sql.unsafe(seed)
  const users = await sql`SELECT email FROM "user" ORDER BY email`
  console.log(`seeded ${users.length} synthetic users: ${users.map((u) => u.email).join(', ')}`)
} finally {
  await sql.end({ timeout: 2 })
}
