import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { applyNeonSchema } from '../isolationDb.ts'
import { createPgRestClient, type PgRestClient } from './pgrest.ts'
import { runInBridge } from './bridge.ts'

// The model is the only thing faked: the real gather (deriveEntries) and the
// real concordance merge (scanConcordanceEntries) write through the shim.
vi.mock(import('../../../api/_lib/openai.ts'), async (orig) => ({
  ...(await orig()),
  callModel: vi.fn(async () => ({
    entries: [{ id: ENTRY, candidates: [{ kind: 'person', canonical: 'Sam', surface_form: 'Sam' }] }],
  })) as never,
}))

const OWNER = 'mig6-owner-a'
const ENTRY = '6a6a6a6a-0000-4000-8000-000000000006'
const BODY = 'Grateful for dinner with Sam. Remembered Psalm 23:1 and Philippians 4:6-7 tonight.'
let db: PGlite
let server: PGLiteSocketServer
let sql: postgres.Sql
let sb: PgRestClient

beforeAll(async () => {
  db = new PGlite()
  await applyNeonSchema(db)
  server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 4 })
  await server.start()
  sql = postgres(`postgresql://postgres:postgres@${server.getServerConn()}/postgres`, { max: 1, prepare: false, ssl: false, onnotice() {} })
  sb = createPgRestClient(sql)
  await sql`INSERT INTO "user" (id, name, email) VALUES (${OWNER}, 'M', 'm6@example.test')`
  await sb.from('entries').insert({
    id: ENTRY, owner: OWNER, body_markdown: BODY, tags: [], circumstances: {}, created_at: '2026-11-12T08:00:00Z',
  }).throwOnError()
}, 60_000)

afterAll(async () => {
  await sql?.end({ timeout: 5 }).catch(() => {})
  await server?.stop().catch(() => {})
  await db?.close().catch(() => {})
})

const inBridge = <T>(fn: () => Promise<T>) => runInBridge({ client: sb, waitUntil: () => undefined, kick: null }, fn)

describe('0006 column drift', () => {
  it('is recorded and idempotent', async () => {
    const v = await sql<{ version: string }[]>`SELECT version FROM schema_migrations WHERE version = '0006'`
    expect(v).toHaveLength(1)
    await sql.unsafe(readFileSync(join(__dirname, '../../schema/0006_column_drift.sql'), 'utf8'))
    await sql.unsafe(readFileSync(join(__dirname, '../../schema/0006_column_drift.sql'), 'utf8'))
  })

  it('the real gather writes scripture_refs without the legacy canonical column', async () => {
    const { deriveEntries } = await import('../../../api/_lib/derive.ts')
    const r = await inBridge(() => deriveEntries(sb as never, OWNER, [{ id: ENTRY, created_at: '2026-11-12T08:00:00Z', body_markdown: BODY }]))
    expect(r.refs).toBeGreaterThanOrEqual(2)
    const rows = await sql<{ osis_ref: string; canonical: string | null; confidence: number; status: string }[]>`
      SELECT osis_ref, canonical, confidence, status FROM scripture_refs WHERE owner = ${OWNER} ORDER BY osis_ref`
    expect(rows.length).toBe(r.refs)
    for (const row of rows) {
      expect(row.canonical).toBeNull()
      expect(typeof row.confidence).toBe('number')
      expect(row.status).toBeTruthy()
    }
  })

  it('the real concordance merge inserts a concordance row without the legacy term column', async () => {
    const { scanConcordanceEntries } = await import('../../../api/_lib/concordance.ts')
    await inBridge(() => scanConcordanceEntries(OWNER, [{ id: ENTRY, created_at: '2026-11-12T08:00:00Z', body_markdown: BODY }], 'import'))
    const rows = await sql<{ canonical: string; term: string | null; occurrence_count: number }[]>`
      SELECT canonical, term, occurrence_count FROM concordance WHERE owner = ${OWNER}`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ canonical: 'Sam', term: null, occurrence_count: 1 })
  })

  it('types and defaults match Supabase for what the app writes', async () => {
    await sb.from('profiles').upsert({ owner: OWNER, scripture_scan_watermark: 7 }, { onConflict: 'owner' }).throwOnError()
    const p = await sb.from('profiles').select('scripture_scan_watermark, plan').eq('owner', OWNER).single()
    expect(p.data).toMatchObject({ scripture_scan_watermark: 7, plan: 'none' })

    await sb.from('welcome_drip_enrollments').insert({ owner: OWNER, enrolled_at: '2026-11-13', source: 'signup' }).throwOnError()
    const w = await sb.from('welcome_drip_enrollments').select('enrolled_at').eq('owner', OWNER).single()
    expect(String((w.data as { enrolled_at: unknown }).enrolled_at).slice(0, 10)).toBe('2026-11-13')

    await sb.from('resurface_dismissals').upsert(
      { owner: OWNER, source_type: 'reflection', source_id: 'weekly:2026-11-09' },
      { onConflict: 'owner,source_type,source_id' },
    ).throwOnError()

    const job = await sb.from('processing_jobs').insert({ owner: OWNER, kind: 'gather', status: 'queued' }).select('total').single()
    expect(job.data).toMatchObject({ total: 0 })
  })
})
