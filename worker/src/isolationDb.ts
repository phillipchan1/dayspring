/**
 * Apply the Neon schema onto PGlite, then the isolation seed.
 * Test-only (excluded from the Worker tsconfig).
 *
 * Numbered files (`NNNN_*.sql`) apply in numeric order and are recorded in
 * `schema_migrations`. Never re-run 0001 after 0002: 0001's
 * `CREATE OR REPLACE` would reset `set_updated_at` to `NOW()`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const schemaDir = join(here, '../schema')
const seedPath = join(schemaDir, 'isolation-seed.sql')

export function schemaFileVersion(filename: string): number {
  const match = /^(\d{4})_/.exec(basename(filename))
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

/** Numbered schema files in numeric order (`0001_init.sql`, `0002_…`). */
export function listSchemaFiles(): string[] {
  return readdirSync(schemaDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort((a, b) => schemaFileVersion(a) - schemaFileVersion(b) || a.localeCompare(b))
    .map((name) => join(schemaDir, name))
}

export function nextMigrationVersions(applied: Iterable<string>, files = listSchemaFiles()): string[] {
  const have = new Set(applied)
  const maxApplied = Math.max(0, ...[...have].map((v) => Number(v)).filter((n) => Number.isFinite(n)))
  const next: string[] = []
  for (const path of files) {
    const n = schemaFileVersion(path)
    const version = String(n).padStart(4, '0')
    if (have.has(version)) continue
    if (n === 1 && maxApplied >= 2) continue
    next.push(version)
  }
  return next
}

export async function applyNumberedMigrations(args: {
  exec: (sql: string) => Promise<unknown>
  versions: () => Promise<string[]>
  hasEntries?: () => Promise<boolean>
}): Promise<void> {
  await args.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const applied = new Set(await args.versions())
  if (!applied.has('0001') && args.hasEntries && await args.hasEntries()) {
    await args.exec(`INSERT INTO schema_migrations (version) VALUES ('0001') ON CONFLICT DO NOTHING`)
    applied.add('0001')
  }
  for (const version of nextMigrationVersions(applied)) {
    const path = listSchemaFiles().find((file) => schemaFileVersion(file) === Number(version))
    if (!path) continue
    try {
      await args.exec(readFileSync(path, 'utf8'))
    } catch {
      throw new Error(`migration ${version} failed`)
    }
    await args.exec(`INSERT INTO schema_migrations (version) VALUES ('${version}')`)
    applied.add(version)
  }
}

export async function applyNeonSchema(db: PGlite): Promise<void> {
  await applyNumberedMigrations({
    exec: (sql) => db.exec(sql),
    async versions() {
      const result = await db.query<{ version: string }>('SELECT version FROM schema_migrations')
      return result.rows.map((row) => row.version)
    },
    async hasEntries() {
      const result = await db.query<{ ok: boolean }>(
        "SELECT to_regclass('public.entries') IS NOT NULL AS ok",
      )
      return Boolean(result.rows[0]?.ok)
    },
  })
}

export async function applyIsolationSchema(db: PGlite): Promise<void> {
  await applyNeonSchema(db)
  await db.exec(readFileSync(seedPath, 'utf8'))
}
