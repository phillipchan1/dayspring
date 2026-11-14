// The Worker's tick budget, end to end on PGlite through the shim: real drain,
// real process-tick handler, real claim RPC (0007), real upsertInsight. Only the
// model work is faked, and each fake unit advances a virtual clock by what it
// cost on prod (Nov 13: one reflection ≈ 10–12 s, a gather chunk ≈ 10 s). Every
// unit kind advances the clock, so the outcome doesn't depend on claim order.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { applyNeonSchema } from '../isolationDb.ts'
import { createPgRestClient, type PgRestClient } from './pgrest.ts'
import { runInBridge } from './bridge.ts'

let vt = 1_800_000_000_000
const cost = (ms: number) => { vt += ms }
const killOnce = { period: null as string | null }
// A pool-6 reflections batch runs its calls concurrently and costs about one model
// call (≈ 11.4 s), so each fake reflection adds 1/6 of that.
const REFLECTION_CALL_MS = 1_900

vi.mock(import('../../../api/_lib/synthesize.ts'), async (orig) => {
  const real = await orig()
  const { supabaseAdmin } = await import('../../../api/_lib/supabaseAdmin.ts')
  const build = (type: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => vi.fn(async (owner: string, p: { start: string; end: string }) => {
    await real.upsertInsight(supabaseAdmin() as never, {
      owner, type, period_start: p.start, period_end: p.end, source_ids: [], structured_payload: {} as never, source_model: 'test',
    })
    cost(REFLECTION_CALL_MS)
    if (killOnce.period === `${type}:${p.start}`) {
      killOnce.period = null
      throw new Error('simulated kill mid-unit')
    }
    return { type, period: p, status: 'built' }
  })
  return { ...real, buildWeekly: build('weekly'), buildMonthly: build('monthly'), buildQuarterly: build('quarterly'), buildYearly: build('yearly') }
})
vi.mock(import('../../../api/_lib/gatherEngine.ts'), async (orig) => {
  const real = await orig()
  const { supabaseAdmin } = await import('../../../api/_lib/supabaseAdmin.ts')
  return {
    ...real,
    gatherChunk: vi.fn(async (owner: string, opts: { max?: number }) => {
      const sb = supabaseAdmin()
      const { data } = await sb.rpc('gather_pending_entries', { p_owner: owner, p_settle: '0 minutes', p_limit: opts.max ?? 48 })
      const rows = (data ?? []) as { id: string; body_hash: string }[]
      for (const r of rows) await sb.from('entries').update({ gathered_hash: r.body_hash }).eq('id', r.id)
      if (rows.length) cost(10_000)
      return { read: rows.length, gathered: rows.length, failed: 0, givenUp: 0, modelSkipped: 0, planted: 0, merged: 0, derived: { items: 0, refs: 0, foreign: 0 } }
    }),
  }
})
vi.mock(import('../../../api/_lib/altar.ts'), async (orig) => ({
  ...(await orig()),
  embedUnembeddedItems: vi.fn(async () => { cost(4_000); return { embedded: 0 } }) as never,
}))
vi.mock(import('../../../api/_lib/declared.ts'), async (orig) => ({
  ...(await orig()),
  tagSubjects: vi.fn(async () => { cost(4_000); return { read: 0, tagged: 0, remaining: 0 } }) as never,
  regroupDeclared: vi.fn(async () => ({})) as never,
}))

const OWNER = 'tick-owner-a'
const RANGE = { start: '2026-11-10', end: '2026-11-12' }
let db: PGlite
let server: PGLiteSocketServer
let sql: postgres.Sql

beforeAll(async () => {
  db = new PGlite()
  await applyNeonSchema(db)
  server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 4 })
  await server.start()
  sql = postgres(`postgresql://postgres:postgres@${server.getServerConn()}/postgres`, { max: 1, prepare: false, ssl: false, onnotice() {} })
  await sql`INSERT INTO "user" (id, name, email) VALUES (${OWNER}, 'T', 'tick@example.test')`
  process.env.CRON_SECRET = 'tick-cron'
}, 60_000)

afterAll(async () => {
  vi.restoreAllMocks()
  await sql?.end({ timeout: 5 }).catch(() => {})
  await server?.stop().catch(() => {})
  await db?.close().catch(() => {})
})

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockImplementation(() => vt)
  await sql`DELETE FROM processing_jobs`
  await sql`DELETE FROM insights`
  await sql`DELETE FROM entries`
})

/** Run process-tick the way the Worker does: each kick queues the next tick. */
async function runChain(maxTicks = 60) {
  const { GET } = await import('../../../api/cron/process-tick.ts')
  const ticks: Array<{ wallMs: number; claimed: number; results: Array<Record<string, unknown>> }> = []
  let kicked = 1
  while (kicked > 0 && ticks.length < maxTicks) {
    kicked = 0
    const sb: PgRestClient = createPgRestClient(sql)
    const t0 = vt
    const res = await runInBridge({ client: sb, waitUntil: () => undefined, kick: async () => { kicked++ } }, async () =>
      GET(new Request('https://w/api/cron/process-tick', { headers: { authorization: 'Bearer tick-cron' } })),
    )
    const body = await res.json() as { claimed: number; results: Array<Record<string, unknown>> }
    ticks.push({ wallMs: vt - t0, claimed: body.claimed, results: body.results })
    cost(50) // the next kicked invocation starts a moment later
  }
  return ticks
}

async function insertEntries(n: number) {
  for (let i = 0; i < n; i++) {
    await sql`INSERT INTO entries (owner, body_markdown, tags, circumstances, created_at) VALUES (${OWNER}, ${'entry ' + i}, '{}', '{}', ${'2026-11-1' + (i % 3) + 'T08:00:00Z'})`
  }
}

describe('Worker tick budget: chained ticks finish whole jobs', () => {
  // Both claim orders, pinned by created_at (drain runs claimed jobs oldest first).
  it.each([
    { first: 'reflections' },
    { first: 'gather' },
  ])('70/70 reflections and a 20-entry import gather complete through chained ticks ($first claimed first); every tick ≤ 30 s; nothing left running', async ({ first }) => {
    const { reflectionsTasks } = await import('../../../api/_lib/processing.ts')
    const total = reflectionsTasks(RANGE).length
    expect(total).toBe(70)
    await insertEntries(20)
    const [tRefl, tGather] = first === 'reflections' ? ['2026-11-13T00:00:00Z', '2026-11-13T00:00:01Z'] : ['2026-11-13T00:00:01Z', '2026-11-13T00:00:00Z']
    await sql`INSERT INTO processing_jobs (owner, kind, status, total, cursor, created_at) VALUES
      (${OWNER}, 'reflections', 'queued', ${total}, ${sql.json({ range: RANGE, index: 0 })}, ${tRefl}),
      (${OWNER}, 'gather', 'queued', 20, ${sql.json({ origin: 'import' })}, ${tGather})`
    const ticks = await runChain()
    expect(ticks.at(-1)!.claimed).toBe(0) // the chain ended by itself
    for (const t of ticks) expect(t.wallMs).toBeLessThanOrEqual(30_000)
    // The first tick claims both; the first-claimed job fills the budget, so the
    // other is released as deferred (not left locked) and the chain continues.
    expect(ticks[0]!.claimed).toBe(2)
    expect(ticks[0]!.results.find((r) => r.kind !== first)).toMatchObject({ status: 'deferred' })
    expect(ticks.some((t) => t.results.some((r) => r.status === 'deferred'))).toBe(true)
    const jobs = await sql<{ kind: string; status: string; completed: number }[]>`SELECT kind, status, completed FROM processing_jobs WHERE owner = ${OWNER} ORDER BY kind`
    expect(jobs.filter((j) => j.status === 'running' || j.status === 'queued')).toEqual([])
    expect(jobs.find((j) => j.kind === 'reflections')).toMatchObject({ status: 'done', completed: 70 })
    expect(jobs.find((j) => j.kind === 'gather')).toMatchObject({ status: 'done', completed: 20 })
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM insights WHERE owner = ${OWNER}`
    expect(n).toBe(70)
    const [{ pending }] = await sql<{ pending: number }[]>`SELECT count(*)::int pending FROM entries WHERE owner = ${OWNER} AND gathered_hash IS DISTINCT FROM body_hash`
    expect(pending).toBe(0)
  })

  it('a tick killed mid-unit: the stuck job is reclaimed after 90 s, finished, with no duplicate insights', async () => {
    const { reflectionsTasks } = await import('../../../api/_lib/processing.ts')
    const tasks = reflectionsTasks(RANGE)
    killOnce.period = `${tasks[8]!.stage}:${tasks[8]!.period.start}`
    await sql`INSERT INTO processing_jobs (owner, kind, status, total, cursor) VALUES (${OWNER}, 'reflections', 'queued', 70, ${sql.json({ range: RANGE, index: 0 })})`
    const first = await runChain(3)
    // The killed unit left the job locked and running (no chain past it)…
    const [stuck] = await sql<{ status: string; locked_at: Date | null; completed: number }[]>`SELECT status, locked_at, completed FROM processing_jobs WHERE owner = ${OWNER}`
    expect(first.some((t) => t.results.some((r) => r.status === 'retry'))).toBe(true)
    expect(stuck.status).toBe('running')
    expect(stuck.locked_at).not.toBeNull()
    // …a fresh lock is NOT stolen (another tick may still own it)…
    expect((await runChain(1))[0].claimed).toBe(0)
    // …but once the lock is past the 90 s window, the next tick (cron backstop) reclaims and finishes it.
    await sql`UPDATE processing_jobs SET locked_at = now() - interval '91 seconds' WHERE owner = ${OWNER}`
    await runChain()
    const [done] = await sql<{ status: string; completed: number }[]>`SELECT status, completed FROM processing_jobs WHERE owner = ${OWNER}`
    expect(done).toMatchObject({ status: 'done', completed: 70 })
    const [{ n, distinct }] = await sql<{ n: number; distinct: number }[]>`
      SELECT count(*)::int n, count(DISTINCT (type, period_start, period_end))::int AS distinct FROM insights WHERE owner = ${OWNER}`
    expect(n).toBe(70)
    expect(distinct).toBe(70)
  })

  it('Vercel keeps its old sizes (no budget) when the Worker profile is not installed', async () => {
    const { setTickProfile, currentTickProfile, WORKER_TICK_PROFILE } = await import('../../../api/_lib/processing.ts')
    expect(currentTickProfile()).toEqual(WORKER_TICK_PROFILE) // installed by the bridge
    setTickProfile(null)
    try {
      expect(currentTickProfile()).toMatchObject({ budgetMs: null, reflectionsPerTick: 24, gatherPerTick: 48 })
    } finally {
      setTickProfile(WORKER_TICK_PROFILE)
    }
  })
})
