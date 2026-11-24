// Does an idle Dayspring let Neon sleep? Neon suspends compute after ~5 minutes
// with no queries. This drives the Worker's real scheduled() handler minute by
// minute against PGlite (real process-tick, real claim / gather SQL) and counts
// the SQL statements that reach the database each minute, with and without the
// processing gate (worker/src/processingGate.ts). Only model work is faked.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { applyNeonSchema } from '../isolationDb.ts'
import { BACKSTOP_MS, DUE_SLACK_MS, ProcessingGate, gateNoteWrite, resetGateThrottle } from '../processingGate.ts'
import type { Env } from '../env.ts'

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
      return { read: rows.length, gathered: rows.length, failed: 0, givenUp: 0, modelSkipped: 0, planted: 0, merged: 0, derived: { items: 0, refs: 0, foreign: 0 } }
    }),
  }
})
vi.mock(import('../../../api/_lib/altar.ts'), async (orig) => ({
  ...(await orig()),
  embedUnembeddedItems: vi.fn(async () => ({ embedded: 0 })) as never,
}))
vi.mock(import('../../../api/_lib/declared.ts'), async (orig) => ({
  ...(await orig()),
  tagSubjects: vi.fn(async () => ({ read: 0, tagged: 0, remaining: 0 })) as never,
  regroupDeclared: vi.fn(async () => ({})) as never,
}))

const OWNER = 'idle-owner'
const MINUTE = 60_000
let db: PGlite
let server: PGLiteSocketServer
let sql: postgres.Sql
let url: string
let statements = 0
let vt = 1_900_000_000_000

/** NEON_IDLE_TRACE=1 collects each statement's text, to see what a tick sends. */
const traced: string[] = []
/** Count Parse / simple-Query messages: one per SQL statement postgres.js sends. */
function countStatements(buf: Uint8Array): number {
  if (buf.length < 5 || buf[0] === 0) return 0 // startup / SSL request: no type byte
  let n = 0
  let o = 0
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  while (o + 5 <= buf.length) {
    const type = String.fromCharCode(buf[o]!)
    if (type === 'P' || type === 'Q') {
      n++
      if (process.env.NEON_IDLE_TRACE) traced.push(new TextDecoder().decode(buf.subarray(o + 5, o + 1 + view.getInt32(o + 1))).replace(/\0/g, ' '))
    }
    o += 1 + view.getInt32(o + 1)
  }
  return n
}

beforeAll(async () => {
  db = new PGlite()
  await applyNeonSchema(db)
  const raw = db.execProtocolRaw.bind(db)
  db.execProtocolRaw = ((message: Uint8Array, opts?: unknown) => {
    statements += countStatements(message)
    return raw(message, opts as never)
  }) as typeof db.execProtocolRaw
  server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 8 })
  await server.start()
  url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`
  sql = postgres(url, { max: 1, prepare: false, ssl: false, onnotice() {} })
  await sql`INSERT INTO "user" (id, name, email) VALUES (${OWNER}, 'I', 'idle@example.test')`
}, 60_000)

afterAll(async () => {
  if (process.env.NEON_IDLE_TRACE) process.stderr.write(`[neon-idle] statements:\n${traced.map((t) => `  ${t.slice(0, 140)}`).join('\n')}\n`)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await sql?.end({ timeout: 5 }).catch(() => {})
  await server?.stop().catch(() => {})
  await db?.close().catch(() => {})
})

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockImplementation(() => vt)
  // Self-kicks go to the Worker's own origin; swallow them (the cron is the backstop).
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 202 })))
  resetGateThrottle()
  await sql`DELETE FROM processing_jobs`
  await sql`DELETE FROM entries`
})

/** An in-memory Durable Object namespace around the real ProcessingGate class. */
function gateNamespace(): DurableObjectNamespace {
  const store = new Map<string, unknown>()
  const state = {
    storage: {
      get: async (k: string) => structuredClone(store.get(k)),
      put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
    },
  } as unknown as DurableObjectState
  const gate = new ProcessingGate(state)
  return {
    idFromName: () => ({}) as DurableObjectId,
    get: () => ({ fetch: (input: string, init?: RequestInit) => gate.fetch(new Request(input, init)) }),
  } as unknown as DurableObjectNamespace
}

function workerEnv(gate: DurableObjectNamespace | null): Env {
  return {
    DATABASE_URL: url,
    CRON_SECRET: 'idle-cron',
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
    BETTER_AUTH_URL: 'http://127.0.0.1:8787',
    ENVIRONMENT: 'local',
    AI_GATEWAY_ZDR: 'on',
    AI_GATEWAY_API_KEY: 'gw-test',
    GATHER_ENGINE: 'on',
    GATHER_MODE: 'gate',
    GATHER_SETTLE_MINUTES: '0',
    ...(gate ? { PROCESSING_GATE: gate } : {}),
  } as Env
}

/** Fire the every-minute cron `minutes` times; statements sent to Postgres in each minute. */
async function runMinutes(env: Env, minutes: number, onMinute?: (m: number) => Promise<void>): Promise<number[]> {
  const { default: worker } = await import('../index.ts')
  const perMinute: number[] = []
  for (let m = 0; m < minutes; m++) {
    await onMinute?.(m)
    const before = statements
    const pending: Promise<unknown>[] = []
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext
    await worker.scheduled({ cron: '* * * * *', scheduledTime: vt } as ScheduledController, env, ctx)
    while (pending.length) await Promise.allSettled(pending.splice(0))
    perMinute.push(statements - before)
    vt += MINUTE
  }
  return perMinute
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
function longestQuietMinutes(perMinute: number[]): number {
  let best = 0
  let run = 0
  for (const n of perMinute) {
    run = n === 0 ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

// Each simulated minute is a real tick against PGlite: give the hour-long runs room.
describe('an idle Dayspring and Neon', { timeout: 240_000 }, () => {
  it('without the gate (preview / local): the every-minute cron queries Postgres every minute', async () => {
    const perMinute = await runMinutes(workerEnv(null), 60)
    process.stderr.write(`[neon-idle] ungated idle hour: ${sum(perMinute)} statements, longest quiet stretch ${longestQuietMinutes(perMinute)} min\n`)
    expect(perMinute.every((n) => n > 0)).toBe(true)
    expect(longestQuietMinutes(perMinute)).toBe(0)
  })

  it('with the gate: one tick when the gate is new, then silence until the 6-hour backstop', async () => {
    const env = workerEnv(gateNamespace())
    const hours = 7
    const perMinute = await runMinutes(env, hours * 60)
    const ticks = perMinute.map((n, m) => (n > 0 ? m : -1)).filter((m) => m >= 0)
    process.stderr.write(`[neon-idle] gated ${hours} idle hours: ${sum(perMinute)} statements, ticks at minutes ${ticks.join(', ')}, longest quiet stretch ${longestQuietMinutes(perMinute)} min\n`)
    expect(ticks).toEqual([0, BACKSTOP_MS / MINUTE])
    expect(sum(perMinute.slice(1, 60))).toBe(0) // the rest of the first hour sends Neon nothing
    expect(longestQuietMinutes(perMinute)).toBeGreaterThanOrEqual(BACKSTOP_MS / MINUTE - 1)
  })

  it('with the gate: settled writing is still gathered on time, then Neon goes quiet again', async () => {
    const env = workerEnv(gateNamespace())
    const WRITE_AT = 10
    let wroteAt = 0
    const perMinute = await runMinutes(env, 60, async (m) => {
      if (m !== WRITE_AT) return
      // What POST /api/data/entries/upsert-checked does: write, then note the owner.
      await sql`INSERT INTO entries (owner, body_markdown, tags, circumstances) VALUES (${OWNER}, 'Lord, teach me to wait.', '{}', '{}')`
      wroteAt = vt
      gateNoteWrite(env, () => undefined, OWNER)
    })
    const ticks = perMinute.map((n, m) => (n > 0 ? m : -1)).filter((m) => m >= 0)
    process.stderr.write(`[neon-idle] gated hour with one write at minute ${WRITE_AT}: ${sum(perMinute)} statements, ticks at minutes ${ticks.join(', ')}\n`)

    const [{ pending }] = await sql<{ pending: number }[]>`SELECT count(*)::int pending FROM entries WHERE owner = ${OWNER} AND gathered_hash IS DISTINCT FROM body_hash`
    expect(pending).toBe(0) // the write was gathered
    const firstTickAfterWrite = ticks.find((m) => m >= WRITE_AT)!
    // Due at write + settle (0 here) + slack; the cron catches it on the next minute.
    expect((firstTickAfterWrite - WRITE_AT) * MINUTE).toBeLessThanOrEqual(DUE_SLACK_MS + MINUTE)
    expect(wroteAt).toBeGreaterThan(0)
    // The gather job ran, the next tick found the queue empty, and the gate stood down.
    const lastTick = ticks.at(-1)!
    expect(lastTick - firstTickAfterWrite).toBeLessThanOrEqual(2)
    expect(sum(perMinute.slice(lastTick + 1))).toBe(0)
    expect(60 - 1 - lastTick).toBeGreaterThan(5) // a quiet stretch long enough for Neon to suspend
  })
})
