/**
 * The processing gate: lets Neon sleep when nobody is using Dayspring.
 *
 * Neon suspends its compute after ~5 minutes with no queries. The every-minute
 * process-tick cron used to query Postgres every minute, all day (claim jobs +
 * look for settled writing), so the database never slept. Almost every one of
 * those ticks found nothing to do.
 *
 * The gate is one Durable Object that remembers, OUTSIDE Postgres, when tick
 * work can next exist. The cron asks it first (no database involved) and only
 * runs the tick when:
 *
 *   - jobs are in flight: something enqueued or kicked a job, or the last tick
 *     did work or saw queued/running jobs. Ticks run every minute until a tick
 *     reports the queue empty — the same backstop as before for a stalled chain.
 *   - gather work is due: a write to an owner's entries at time t makes them
 *     ready at t + settle (GATHER_SETTLE_MINUTES), so the gate keeps one due
 *     time per owner and ticks once it passes.
 *   - the backstop is due: a full tick at least every BACKSTOP_MS, in case a
 *     note to the gate was lost (it is fire-and-forget).
 *
 * Fail-open everywhere: no binding (preview, local, tests) or a gate error means
 * the cron ticks as it always did. Correctness over cost.
 *
 * The class uses the plain fetch() Durable Object interface (no
 * `cloudflare:workers` import) so Node tests can load this module.
 */
import { parseGatherSettleMinutes } from '../../api/_lib/env.ts'
import type { Env } from './env.ts'

/** Full tick at least this often even when the gate thinks nothing is due. */
export const BACKSTOP_MS = 6 * 60 * 60_000
/** A Worker isolate tells the gate about an owner's writes at most this often. */
export const NOTE_THROTTLE_MS = 60_000
/**
 * Added to every gather due time: covers writes the throttle skipped (each is
 * at most NOTE_THROTTLE_MS after a noted one) plus clock skew between the
 * Worker and Postgres' now().
 */
export const DUE_SLACK_MS = NOTE_THROTTLE_MS + 60_000

export interface GateState {
  /** owner → epoch ms when their latest noted writing is settled and ready to gather. */
  due: Record<string, number>
  /** Jobs may be queued or running: tick every minute. */
  jobsActive: boolean
  /** Latest time something said jobs may exist. A tick that STARTED before this cannot clear it. */
  jobsMarkedAt: number
  /** Start of the latest tick whose settled-gather scan completed. */
  lastScanAt: number
}

/** A new gate knows nothing, so its first cron tick runs (lastScanAt 0 → backstop due). */
export function emptyGateState(): GateState {
  return { due: {}, jobsActive: false, jobsMarkedAt: 0, lastScanAt: 0 }
}

export type TickReason = 'jobs' | 'gather-due' | 'backstop'

export function tickReason(state: GateState, now: number): TickReason | null {
  if (state.jobsActive) return 'jobs'
  for (const dueAt of Object.values(state.due)) if (dueAt <= now) return 'gather-due'
  if (now - state.lastScanAt >= BACKSTOP_MS) return 'backstop'
  return null
}

export function noteWrite(state: GateState, owner: string, dueAt: number): void {
  const prev = state.due[owner]
  if (prev === undefined || dueAt > prev) state.due[owner] = dueAt
}

export function noteJobs(state: GateState, at: number): void {
  state.jobsActive = true
  state.jobsMarkedAt = Math.max(state.jobsMarkedAt, at)
}

export interface TickReport {
  /** When the tick started (Worker clock). */
  startedAt: number
  /** The settled-gather scan ran without error and was not cut short by its limit. */
  scanComplete: boolean
  /** Nothing claimed, no queued/running jobs left, scan complete. */
  idle: boolean
}

export function applyReport(state: GateState, r: TickReport): void {
  if (r.scanComplete) {
    // Every owner due by the tick's start was settled when it scanned, so the
    // scan enqueued them. Later writes raised their due time past startedAt.
    for (const [owner, dueAt] of Object.entries(state.due)) {
      if (dueAt <= r.startedAt) delete state.due[owner]
    }
    state.lastScanAt = Math.max(state.lastScanAt, r.startedAt)
  }
  if (!r.idle) {
    noteJobs(state, r.startedAt)
  } else if (state.jobsMarkedAt <= r.startedAt) {
    // Only a tick that started after the latest "jobs may exist" can clear it.
    state.jobsActive = false
  }
}

/** Durable Object holding one GateState. Use a single instance (idFromName('global')). */
export class ProcessingGate {
  private state: DurableObjectState
  private cached: GateState | null = null

  constructor(state: DurableObjectState) {
    this.state = state
  }

  private async load(): Promise<GateState> {
    if (!this.cached) this.cached = (await this.state.storage.get<GateState>('gate')) ?? emptyGateState()
    return this.cached
  }

  private async save(s: GateState): Promise<void> {
    this.cached = s
    await this.state.storage.put('gate', s)
  }

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const s = await this.load()
    const now = typeof body.now === 'number' ? body.now : Date.now()
    switch (path) {
      case '/should-tick':
        return Response.json({ reason: tickReason(s, now) })
      case '/note-write':
        if (typeof body.owner !== 'string' || typeof body.dueAt !== 'number') return new Response('bad', { status: 400 })
        noteWrite(s, body.owner, body.dueAt)
        await this.save(s)
        return Response.json({ ok: true })
      case '/note-jobs':
        noteJobs(s, now)
        await this.save(s)
        return Response.json({ ok: true })
      case '/report':
        applyReport(s, body as unknown as TickReport)
        await this.save(s)
        return Response.json({ ok: true })
      case '/state':
        return Response.json(s)
      default:
        return new Response('not found', { status: 404 })
    }
  }
}

// ── Worker-side helpers ─────────────────────────────────────────────────────

const GATE_ORIGIN = 'https://gate'

function stub(env: Env): DurableObjectStub | null {
  const ns = env.PROCESSING_GATE
  if (!ns) return null
  return ns.get(ns.idFromName('global'))
}

async function call(env: Env, path: string, body: Record<string, unknown>): Promise<Response | null> {
  const s = stub(env)
  if (!s) return null
  const res = await s.fetch(`${GATE_ORIGIN}${path}`, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`gate ${path} returned ${res.status}`)
  return res
}

function logFailure(what: string, e: unknown): void {
  console.error(`[gate] ${what} failed: ${e instanceof Error ? e.message : String(e)}`)
}

/**
 * Why the every-minute cron should tick now, or null to skip it (no Neon query).
 * No binding or a gate error → 'ungated' (tick, as before the gate).
 */
export async function gateTickReason(env: Env, now = Date.now()): Promise<TickReason | 'ungated' | null> {
  try {
    const res = await call(env, '/should-tick', { now })
    if (!res) return 'ungated'
    return ((await res.json()) as { reason: TickReason | null }).reason
  } catch (e) {
    logFailure('should-tick', e)
    return 'ungated'
  }
}

/** Per-isolate throttle: owner → when this isolate last noted their writing. */
const lastNoted = new Map<string, number>()

/** Test hook. */
export function resetGateThrottle(): void {
  lastNoted.clear()
}

/**
 * An owner's entries changed: their gather becomes due one settle window from
 * now. Fire-and-forget; never delays or fails the write.
 */
export function gateNoteWrite(env: Env, waitUntil: (p: Promise<unknown>) => void, owner: string, now = Date.now()): void {
  if (!env.PROCESSING_GATE) return
  const last = lastNoted.get(owner)
  if (last !== undefined && now - last < NOTE_THROTTLE_MS) return
  lastNoted.set(owner, now)
  if (lastNoted.size > 5_000) lastNoted.clear()
  const dueAt = now + parseGatherSettleMinutes(env.GATHER_SETTLE_MINUTES) * 60_000 + DUE_SLACK_MS
  waitUntil(call(env, '/note-write', { owner, dueAt }).catch((e) => {
    lastNoted.delete(owner)
    logFailure('note-write', e)
  }))
}

/** A job may have been enqueued or kicked: tick every minute until the queue is empty. */
export function gateNoteJobs(env: Env, waitUntil: (p: Promise<unknown>) => void, now = Date.now()): void {
  if (!env.PROCESSING_GATE) return
  waitUntil(call(env, '/note-jobs', { now }).catch((e) => logFailure('note-jobs', e)))
}

/** Tell the gate how a process-tick went, from its JSON response. */
export async function gateReportTick(env: Env, startedAt: number, res: Response): Promise<void> {
  if (!env.PROCESSING_GATE) return
  let report: TickReport = { startedAt, scanComplete: false, idle: false }
  if (res.ok) {
    try {
      const body = (await res.clone().json()) as { scan_complete?: unknown; idle?: unknown }
      report = { startedAt, scanComplete: body.scan_complete === true, idle: body.idle === true }
    } catch {
      /* unreadable body: treat as not idle, so the next minute ticks again */
    }
  }
  try {
    await call(env, '/report', report as unknown as Record<string, unknown>)
  } catch (e) {
    logFailure('report', e)
  }
}
