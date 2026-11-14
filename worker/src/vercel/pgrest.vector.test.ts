import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { applyNeonSchema } from '../isolationDb.ts'
import { createPgRestClient } from './pgrest.ts'

// 0005 creates match_entries / match_entries_for_thread only where pgvector exists
// (Neon has it; CI's postgres:17 does not). PGlite's vector extension stands in here.
let db: PGlite
let server: PGLiteSocketServer
let sql: postgres.Sql

beforeAll(async () => {
  db = new PGlite({ extensions: { vector } })
  await applyNeonSchema(db)
  server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 4 })
  await server.start()
  sql = postgres(`postgresql://postgres:postgres@${server.getServerConn()}/postgres`, { max: 1, prepare: false, ssl: false, onnotice() {} })
}, 60_000)

afterAll(async () => {
  await sql?.end({ timeout: 5 }).catch(() => {})
  await server?.stop().catch(() => {})
  await db?.close().catch(() => {})
})

describe('0005 pgvector RPCs through the shim', () => {
  it('match_entries ranks text-stored embeddings by cosine distance', async () => {
    const ext = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_extension WHERE extname = 'vector'`
    expect(ext[0].n).toBe(1)
    await sql`INSERT INTO "user" (id, name, email) VALUES ('vec-a', 'V', 'v@example.test')`
    const sb = createPgRestClient(sql)
    await sb.from('entries').insert([
      { owner: 'vec-a', body_markdown: 'near', tags: [], circumstances: {}, embedding: [1, 0, 0], created_at: '2026-03-01T00:00:00Z' },
      { owner: 'vec-a', body_markdown: 'far', tags: [], circumstances: {}, embedding: [0, 1, 0], created_at: '2026-03-02T00:00:00Z' },
    ]).throwOnError()
    const r = await sb.rpc('match_entries', { query_embedding: [0.9, 0.1, 0], owner_id: 'vec-a', match_count: 2 })
    expect(r.error).toBeNull()
    const rows = r.data as Array<{ entry_id: string; distance: number }>
    expect(rows).toHaveLength(2)
    expect(rows[0].distance).toBeLessThan(rows[1].distance)
    const t = await sb.rpc('match_entries_for_thread', { query_embedding: [0, 1, 0], owner_id: 'vec-a', since: '2026-01-01T00:00:00Z', match_count: 1 })
    expect(t.error).toBeNull()
    expect((t.data as unknown[]).length).toBe(1)
  })
})
