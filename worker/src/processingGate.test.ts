import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyReport,
  BACKSTOP_MS,
  DUE_SLACK_MS,
  emptyGateState,
  gateNoteWrite,
  gateTickReason,
  NOTE_THROTTLE_MS,
  noteJobs,
  noteWrite,
  resetGateThrottle,
  tickReason,
} from './processingGate.ts'
import type { Env } from './env.ts'

const T = 1_900_000_000_000
const MIN = 60_000

describe('processing gate state', () => {
  it('a new gate ticks once (backstop), then stays quiet after an idle report', () => {
    const s = emptyGateState()
    expect(tickReason(s, T)).toBe('backstop')
    applyReport(s, { startedAt: T, scanComplete: true, idle: true })
    expect(tickReason(s, T + MIN)).toBeNull()
    expect(tickReason(s, T + BACKSTOP_MS - 1)).toBeNull()
    expect(tickReason(s, T + BACKSTOP_MS)).toBe('backstop')
  })

  it('ticks when an owner\'s writing comes due, and a complete scan clears it', () => {
    const s = emptyGateState()
    applyReport(s, { startedAt: T, scanComplete: true, idle: true })
    noteWrite(s, 'a', T + 32 * MIN)
    expect(tickReason(s, T + 31 * MIN)).toBeNull()
    expect(tickReason(s, T + 32 * MIN)).toBe('gather-due')
    applyReport(s, { startedAt: T + 32 * MIN, scanComplete: true, idle: true })
    expect(s.due).toEqual({})
    expect(tickReason(s, T + 33 * MIN)).toBeNull()
  })

  it('a later write pushes the owner\'s due time out; an earlier note never pulls it in', () => {
    const s = emptyGateState()
    noteWrite(s, 'a', T + 40 * MIN)
    noteWrite(s, 'a', T + 35 * MIN)
    expect(s.due.a).toBe(T + 40 * MIN)
  })

  it('a scan that failed or hit its owner limit keeps every due time, so the next minute looks again', () => {
    const s = emptyGateState()
    noteWrite(s, 'a', T)
    applyReport(s, { startedAt: T + MIN, scanComplete: false, idle: false })
    expect(s.due.a).toBe(T)
    expect(tickReason(s, T + 2 * MIN)).toBe('jobs')
  })

  it('a scan only clears owners due by the tick\'s start — writing noted since stays', () => {
    const s = emptyGateState()
    noteWrite(s, 'a', T)
    noteWrite(s, 'b', T + 10 * MIN)
    applyReport(s, { startedAt: T + MIN, scanComplete: true, idle: true })
    expect(s.due).toEqual({ b: T + 10 * MIN })
  })

  it('jobs keep it ticking until a tick that started after the latest kick finds the queue empty', () => {
    const s = emptyGateState()
    applyReport(s, { startedAt: T, scanComplete: true, idle: true })
    noteJobs(s, T + 5 * MIN) // an import was enqueued and kicked
    expect(tickReason(s, T + 6 * MIN)).toBe('jobs')
    // A tick that began BEFORE the kick reports idle late: it cannot clear the new job.
    applyReport(s, { startedAt: T + 4 * MIN, scanComplete: true, idle: true })
    expect(tickReason(s, T + 6 * MIN)).toBe('jobs')
    // A working tick keeps it on.
    applyReport(s, { startedAt: T + 6 * MIN, scanComplete: true, idle: false })
    expect(tickReason(s, T + 7 * MIN)).toBe('jobs')
    // The tick that ends the chain stands it down.
    applyReport(s, { startedAt: T + 7 * MIN, scanComplete: true, idle: true })
    expect(tickReason(s, T + 8 * MIN)).toBeNull()
  })
})

describe('Worker-side gate helpers', () => {
  beforeEach(() => resetGateThrottle())
  afterEach(() => vi.restoreAllMocks())

  function fakeNamespace(fetch: (path: string, body: Record<string, unknown>) => Response | Promise<Response>) {
    return {
      idFromName: () => ({}),
      get: () => ({
        fetch: async (input: string, init?: RequestInit) =>
          fetch(new URL(input).pathname, JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>),
      }),
    } as unknown as DurableObjectNamespace
  }

  it('without a binding the cron ticks as before (ungated)', async () => {
    expect(await gateTickReason({} as Env)).toBe('ungated')
  })

  it('a gate error fails open: tick', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = { PROCESSING_GATE: fakeNamespace(() => new Response('boom', { status: 500 })) } as Env
    expect(await gateTickReason(env)).toBe('ungated')
  })

  it('notes a write as due one settle window (plus slack) later, at most once per throttle window per owner', async () => {
    const notes: Array<Record<string, unknown>> = []
    const env = {
      GATHER_SETTLE_MINUTES: '30',
      PROCESSING_GATE: fakeNamespace((path, body) => {
        if (path === '/note-write') notes.push(body)
        return Response.json({ ok: true })
      }),
    } as Env
    const tasks: Promise<unknown>[] = []
    const bg = (p: Promise<unknown>) => void tasks.push(p)
    gateNoteWrite(env, bg, 'a', T)
    gateNoteWrite(env, bg, 'a', T + NOTE_THROTTLE_MS - 1) // skipped: covered by the slack
    gateNoteWrite(env, bg, 'b', T + 1)
    gateNoteWrite(env, bg, 'a', T + NOTE_THROTTLE_MS)
    await Promise.all(tasks)
    expect(notes).toEqual([
      { owner: 'a', dueAt: T + 30 * MIN + DUE_SLACK_MS },
      { owner: 'b', dueAt: T + 1 + 30 * MIN + DUE_SLACK_MS },
      { owner: 'a', dueAt: T + NOTE_THROTTLE_MS + 30 * MIN + DUE_SLACK_MS },
    ])
    // The skipped write (at T + throttle - 1) settles by its own due time, which the first note covers.
    expect(T + NOTE_THROTTLE_MS - 1 + 30 * MIN).toBeLessThanOrEqual(T + 30 * MIN + DUE_SLACK_MS)
  })
})
