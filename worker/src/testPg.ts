/**
 * Wire-protocol Postgres for checks that need postgres.js Date semantics.
 * Prefers DAYSPRING_TEST_DATABASE_URL (CI Postgres 17). Otherwise boots
 * PGlite over a TCP socket so postgres.js still returns Date.
 */
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { applyNeonSchema, applyNumberedMigrations } from './isolationDb.ts'
import { postgresSslOption, withPgSslMode, type Sql } from './db.ts'

export interface WireSql {
  sql: Sql
  url: string
  kind: 'postgres' | 'pglite-socket'
  close: () => Promise<void>
}

async function applySchema(sql: Sql): Promise<void> {
  await applyNumberedMigrations({
    exec: (text) => sql.unsafe(text),
    async versions() {
      const rows = await sql<{ version: string }[]>`SELECT version FROM schema_migrations`
      return rows.map((row) => row.version)
    },
    async hasEntries() {
      const rows = await sql<{ ok: boolean }[]>`SELECT to_regclass('public.entries') IS NOT NULL AS ok`
      return Boolean(rows[0]?.ok)
    },
  })
}

export async function openWireSql(): Promise<WireSql> {
  const configured = process.env.DAYSPRING_TEST_DATABASE_URL?.trim()
  if (configured) {
    const prepared = withPgSslMode(configured)
    const sql = postgres(prepared, {
      max: 12,
      prepare: false,
      ssl: postgresSslOption(prepared),
      onnotice() {},
    })
    await applySchema(sql)
    return {
      sql,
      url: configured,
      kind: 'postgres',
      async close() {
        await sql.end({ timeout: 5 })
      },
    }
  }

  const db = new PGlite()
  await applyNeonSchema(db)
  const server = new PGLiteSocketServer({
    db,
    host: '127.0.0.1',
    port: 0,
    maxConnections: 16,
  })
  await server.start()
  const conn = server.getServerConn()
  const url = `postgresql://postgres:postgres@${conn}/postgres`
  const sql = postgres(url, { max: 12, prepare: false, ssl: false, onnotice() {} })
  return {
    sql,
    url,
    kind: 'pglite-socket',
    async close() {
      await sql.end({ timeout: 5 }).catch(() => {})
      await server.stop().catch(() => {})
      await db.close().catch(() => {})
    },
  }
}
