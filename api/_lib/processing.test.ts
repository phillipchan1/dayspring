// The processing engine's retry accounting — what `attempts` means, and what a
// chunk that made no progress does.
//
// Two regressions live here, both found reading the engine against a long import:
//
//   · `attempts` was bumped on every CLAIM and never written back, so it counted
//     ticks, not failures. A 15-year archive needs ~43 reflections ticks; after
//     the fifth healthy one, the first transient error failed the job for good.
//   · a harvest (or concordance) tick whose model calls all failed returned
//     normally. The job stayed "running", the same unreadable entries stayed at
//     the head of the queue, and it re-ticked every minute without ever reaching
//     embed → thread.
//
// The model, the scanners and the database are all doubles: this is about the
// engine's bookkeeping, which is pure.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('./supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('./synthesize.js', () => ({
  buildWeekly: vi.fn(),
  buildMonthly: vi.fn(),
  buildQuarterly: vi.fn(),
  buildYearly: vi.fn(),
}))
vi.mock('./altar.js', () => ({
  harvestPlan: vi.fn(),
  harvestPrayers: vi.fn(),
  embedUnembedded: vi.fn(),
  embedUnembeddedItems: vi.fn(),
}))
vi.mock('./declared.js', () => ({ tagSubjects: vi.fn(), regroupDeclared: vi.fn() }))
vi.mock('./concordance.js', () => ({ concordancePlan: vi.fn(), scanConcordance: vi.fn() }))
vi.mock('./gatherEngine.js', () => ({
  GATHER_PER_TICK: 48,
  gatherChunk: vi.fn(),
  gatherPendingCount: vi.fn(),
  gatherPendingOwners: vi.fn(),
}))

import { supabaseAdmin } from './supabaseAdmin.js'
import { embedUnembeddedItems, harvestPlan, harvestPrayers } from './altar.js'
import { concordancePlan, scanConcordance } from './concordance.js'
import { regroupDeclared, tagSubjects } from './declared.js'
import { gatherChunk, gatherPendingCount, gatherPendingOwners } from './gatherEngine.js'
import { drain, enqueueBackfill, enqueueSettledGathers, type Job } from './processing.js'

/** One claimed job in, every processing_jobs write out. */
function mockSb(claimed: Partial<Job> & Pick<Job, 'kind'>) {
  const job: Job = {
    id: 'job-1',
    owner: 'owner',
    status: 'running',
    cursor: {},
    total: 100,
    completed: 0,
    attempts: 1,
    ...claimed,
  }
  const updates: Record<string, unknown>[] = []
  const inserts: Record<string, unknown>[] = []
  let deletes = 0
  const sb = {
    rpc: (name: string) => {
      if (name !== 'claim_processing_jobs') throw new Error(`unexpected rpc ${name}`)
      return Promise.resolve({ data: [job], error: null })
    },
    from() {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        delete: () => {
          deletes++
          return chain
        },
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload)
          return chain
        },
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return Promise.resolve({ error: null })
        },
        then: (resolve: (v: { data: null; error: null }) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      }
      return chain
    },
  }
  vi.mocked(supabaseAdmin).mockReturnValue(sb as never)
  return { updates, inserts, deletes: () => deletes }
}

beforeEach(() => {
  delete process.env.GATHER_ENGINE
  delete process.env.GATHER_SETTLE_MINUTES
  vi.mocked(gatherChunk).mockReset()
  vi.mocked(gatherPendingCount).mockReset()
  vi.mocked(gatherPendingOwners).mockReset()
  vi.mocked(embedUnembeddedItems).mockReset().mockResolvedValue({ items: 0 })
  vi.mocked(tagSubjects).mockReset()
  vi.mocked(regroupDeclared).mockReset()
  vi.mocked(harvestPrayers).mockReset()
  vi.mocked(harvestPlan).mockReset()
  vi.mocked(scanConcordance).mockReset()
  vi.mocked(concordancePlan).mockReset()
})

describe('attempts counts consecutive failures', () => {
  it('a successful chunk writes attempts back to 0, however many ticks came before', async () => {
    // the 40th healthy tick of a long import: the claim has bumped attempts to 40
    const { updates } = mockSb({ kind: 'altar_harvest', attempts: 40 })
    vi.mocked(harvestPrayers).mockResolvedValue({ scanned: 60, candidates: 20, planted: 9, failed: 0, failedIds: [] })
    vi.mocked(harvestPlan).mockResolvedValue({ unscanned: 500, candidates: 200 })

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ kind: 'altar_harvest', status: 'running', completed: 60 })
    expect(updates).toEqual([{ completed: 60, locked_at: null, attempts: 0 }])
  })

  it('a chunk that makes partial progress is a success: the unread entries wait for the next tick', async () => {
    const { updates } = mockSb({ kind: 'altar_harvest', attempts: 3 })
    vi.mocked(harvestPrayers).mockResolvedValue({ scanned: 54, candidates: 20, planted: 4, failed: 6, failedIds: ['a', 'b', 'c', 'd', 'e', 'f'] })
    vi.mocked(harvestPlan).mockResolvedValue({ unscanned: 6, candidates: 6 })

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ status: 'running', completed: 54, remaining: 6 })
    expect(updates[0]).toMatchObject({ attempts: 0 })
  })
})

describe('a tick that read nothing fails instead of looping', () => {
  it('altar_harvest: retries with the error recorded, and leaves the lock as its backoff', async () => {
    const { updates, inserts } = mockSb({ kind: 'altar_harvest', attempts: 2 })
    vi.mocked(harvestPrayers).mockResolvedValue({ scanned: 0, candidates: 6, planted: 0, failed: 6, failedIds: ['a', 'b', 'c', 'd', 'e', 'f'] })

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ kind: 'altar_harvest', status: 'retry' })
    expect(String(summary?.error)).toContain('6 entries')
    // error only: no status change, no lock clear, attempts untouched
    expect(updates).toEqual([{ error: expect.stringContaining('none read') }])
    expect(inserts).toEqual([])
    expect(harvestPlan).not.toHaveBeenCalled()
  })

  it('altar_harvest: gives up on the fifth consecutive failure, and still hands on what it planted', async () => {
    const { updates, inserts } = mockSb({ kind: 'altar_harvest', attempts: 5 })
    vi.mocked(harvestPrayers).mockResolvedValue({ scanned: 0, candidates: 6, planted: 0, failed: 6, failedIds: ['a', 'b', 'c', 'd', 'e', 'f'] })

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ status: 'failed' })
    expect(updates[0]).toMatchObject({ status: 'failed', locked_at: null })
    expect(inserts).toEqual([
      expect.objectContaining({ owner: 'owner', kind: 'altar_embed', status: 'queued' }),
    ])
  })

  it('concordance: the same guard', async () => {
    const { updates } = mockSb({ kind: 'concordance', attempts: 1 })
    vi.mocked(scanConcordance).mockResolvedValue({ scanned: 0, merged: 0, failed: 8, failedIds: ['1', '2', '3', '4', '5', '6', '7', '8'] })

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ kind: 'concordance', status: 'retry' })
    expect(updates).toEqual([{ error: expect.stringContaining('8 entries') }])
    expect(concordancePlan).not.toHaveBeenCalled()
  })
})

const chunk = (over: Record<string, unknown> = {}) => ({
  read: 3,
  gathered: 3,
  failed: 0,
  givenUp: 0,
  modelSkipped: 0,
  planted: 1,
  merged: 2,
  derived: { items: 0, refs: 0, foreign: 0 },
  ...over,
})

describe('the gather job', () => {
  it('a writing session waits for the settle window; an import does not', async () => {
    mockSb({ kind: 'gather', cursor: { origin: 'write' } })
    vi.mocked(gatherChunk).mockResolvedValue(chunk())
    vi.mocked(gatherPendingCount).mockResolvedValue(5)
    await drain(1)
    expect(vi.mocked(gatherChunk).mock.calls[0]?.[1]).toMatchObject({ settleMinutes: 30, source: 'repetition' })

    mockSb({ kind: 'gather', cursor: { origin: 'import' } })
    await drain(1)
    expect(vi.mocked(gatherChunk).mock.calls[1]?.[1]).toMatchObject({ settleMinutes: 0, source: 'import' })
  })

  it('keeps running while entries remain, with a total that tracks the queue', async () => {
    const { updates } = mockSb({ kind: 'gather', cursor: { origin: 'import' }, completed: 96, attempts: 7 })
    vi.mocked(gatherChunk).mockResolvedValue(chunk({ read: 48, gathered: 46, failed: 1, givenUp: 1 }))
    vi.mocked(gatherPendingCount).mockResolvedValue(200)

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ kind: 'gather', status: 'running', completed: 143, remaining: 200 })
    expect(updates).toEqual([{ completed: 143, total: 343, locked_at: null, attempts: 0 }])
  })

  it('an import that drains hands the archive to a visible altar_thread job', async () => {
    const { updates, inserts, deletes } = mockSb({ kind: 'gather', cursor: { origin: 'import' } })
    vi.mocked(gatherChunk).mockResolvedValue(chunk())
    vi.mocked(gatherPendingCount).mockResolvedValue(0)

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ status: 'done', origin: 'import' })
    expect(embedUnembeddedItems).toHaveBeenCalledWith('owner')
    expect(updates).toEqual([{ status: 'done', completed: 3, total: 3, locked_at: null, attempts: 0 }])
    expect(inserts).toEqual([expect.objectContaining({ kind: 'altar_thread', status: 'queued' })])
    expect(tagSubjects).not.toHaveBeenCalled()
    expect(deletes()).toBe(0)
  })

  // The banner reads every processing_jobs row but a writing-session gather. A
  // visible altar_thread job after each entry would raise "still preparing…" and
  // then celebrate — so the handful of new lines are tagged here instead.
  it('a writing session that drains tags inline, regroups, and leaves no row behind', async () => {
    const { updates, inserts, deletes } = mockSb({ kind: 'gather', cursor: { origin: 'write' } })
    vi.mocked(gatherChunk).mockResolvedValue(chunk())
    vi.mocked(gatherPendingCount).mockResolvedValue(0)
    vi.mocked(tagSubjects).mockResolvedValue({ read: 2, remaining: 0 } as never)
    vi.mocked(regroupDeclared).mockResolvedValue({ threads: 4 } as never)

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ status: 'done', origin: 'write', tagBacklog: false })
    expect(tagSubjects).toHaveBeenCalledWith('owner', { max: 120 })
    expect(regroupDeclared).toHaveBeenCalledWith('owner')
    expect(inserts).toEqual([])
    expect(updates).toEqual([])
    expect(deletes()).toBe(1)
  })

  it('a writing session with nothing new to tag does not regroup', async () => {
    mockSb({ kind: 'gather', cursor: { origin: 'write' } })
    vi.mocked(gatherChunk).mockResolvedValue(chunk({ planted: 0 }))
    vi.mocked(gatherPendingCount).mockResolvedValue(0)
    vi.mocked(tagSubjects).mockResolvedValue({ read: 0, remaining: 0 } as never)

    await drain(1)

    expect(regroupDeclared).not.toHaveBeenCalled()
  })

  it('an outage in the chunk is a job failure, with the usual backoff', async () => {
    const { updates } = mockSb({ kind: 'gather', cursor: { origin: 'write' }, attempts: 1 })
    vi.mocked(gatherChunk).mockRejectedValue(new Error('gather: model call failed for all 6 entries'))

    const [summary] = await drain(1)

    expect(summary).toMatchObject({ kind: 'gather', status: 'retry' })
    expect(updates).toEqual([{ error: expect.stringContaining('all 6 entries') }])
  })
})

describe('GATHER_ENGINE flag', () => {
  it('off: the tick enqueues nothing and never looks', async () => {
    mockSb({ kind: 'gather' })
    expect(await enqueueSettledGathers()).toBe(0)
    expect(gatherPendingOwners).not.toHaveBeenCalled()
  })

  it('on: every owner with settled writing gets a gather job', async () => {
    process.env.GATHER_ENGINE = 'on'
    const { inserts } = mockSb({ kind: 'gather' })
    vi.mocked(gatherPendingOwners).mockResolvedValue([
      { owner: 'a', pending: 2 },
      { owner: 'b', pending: 1 },
    ])
    vi.mocked(gatherPendingCount).mockResolvedValue(2)

    expect(await enqueueSettledGathers()).toBe(2)
    expect(gatherPendingOwners).toHaveBeenCalledWith(30, 25)
    expect(inserts).toEqual([
      expect.objectContaining({ owner: 'a', kind: 'gather', cursor: { origin: 'write' } }),
      expect.objectContaining({ owner: 'b', kind: 'gather', cursor: { origin: 'write' } }),
    ])
  })

  it('off: an import enqueues the old harvest + concordance jobs', async () => {
    const { inserts } = mockSb({ kind: 'reflections' })
    vi.mocked(harvestPlan).mockResolvedValue({ unscanned: 10, candidates: 4 })
    vi.mocked(concordancePlan).mockResolvedValue({ unscanned: 10 })

    const out = await enqueueBackfill('owner', { start: '2026-01-01', end: '2026-01-31' })

    expect(out.enqueued).toEqual(['reflections', 'altar_harvest', 'concordance'])
    expect(inserts.map((r) => r.kind)).toEqual(['reflections', 'altar_harvest', 'concordance'])
  })

  it('on: an import enqueues one gather job in their place, read without settling', async () => {
    process.env.GATHER_ENGINE = 'on'
    const { inserts } = mockSb({ kind: 'reflections' })
    vi.mocked(gatherPendingCount).mockResolvedValue(127)

    const out = await enqueueBackfill('owner', { start: '2026-01-01', end: '2026-01-31' })

    expect(out.enqueued).toEqual(['reflections', 'gather'])
    expect(gatherPendingCount).toHaveBeenCalledWith('owner', 0)
    expect(inserts[1]).toMatchObject({ kind: 'gather', total: 127, cursor: { origin: 'import' } })
    expect(harvestPlan).not.toHaveBeenCalled()
  })
})
