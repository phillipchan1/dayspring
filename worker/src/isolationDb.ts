/**
 * Apply the Neon schema onto PGlite, then the isolation seed.
 * Test-only (excluded from the Worker tsconfig).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(here, '../schema/0001_init.sql')
const seedPath = join(here, '../schema/isolation-seed.sql')

export async function applyNeonSchema(db: PGlite): Promise<void> {
  const schema = readFileSync(schemaPath, 'utf8')
  try {
    await db.exec(schema)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`0001_init.sql: ${message}`)
  }
}

export async function applyIsolationSchema(db: PGlite): Promise<void> {
  await applyNeonSchema(db)
  await db.exec(readFileSync(seedPath, 'utf8'))
}
