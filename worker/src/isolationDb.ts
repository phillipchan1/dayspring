/**
 * Apply the Neon schema onto PGlite, then the isolation seed.
 * Test-only (excluded from the Worker tsconfig).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const schemaDir = join(here, '../schema')
const seedPath = join(schemaDir, 'isolation-seed.sql')

/** Numbered schema files in order (`0001_init.sql`, `0002_…`). */
export function listSchemaFiles(): string[] {
  return readdirSync(schemaDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
    .map((name) => join(schemaDir, name))
}

export async function applyNeonSchema(db: PGlite): Promise<void> {
  for (const path of listSchemaFiles()) {
    try {
      await db.exec(readFileSync(path, 'utf8'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`${path.split('/').pop()}: ${message}`)
    }
  }
}

export async function applyIsolationSchema(db: PGlite): Promise<void> {
  await applyNeonSchema(db)
  await db.exec(readFileSync(seedPath, 'utf8'))
}
