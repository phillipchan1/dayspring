// The gather engine's decisions: which steps an entry needs, what gets stamped,
// and what a failure costs. The scanners themselves are doubles — they have
// their own tests — so every assertion here is about the ENGINE: a re-read that
// should not have called the model, an edit that slipped past, an outage that
// was charged to the entries it could not read.
//
// The SQL half (pending/settle/stamp) is exercised against a real Postgres by
// supabase/tests/gather_engine.test.sql; here the RPCs are stand-ins that record
// their input.

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('./derive.js', () => ({ deriveEntries: vi.fn() }))
vi.mock('./altar.js', () => ({ embedEntries: vi.fn(), harvestEntries: vi.fn() }))
vi.mock('./concordance.js', () => ({ scanConcordanceEntries: vi.fn() }))

import { supabaseAdmin } from './supabaseAdmin.js'
import { deriveEntries } from './derive.js'
import { embedEntries, harvestEntries } from './altar.js'
import { scanConcordanceEntries } from './concordance.js'
import { writerWords } from './writerWords.js'
import { GATHER_MAX_ATTEMPTS, gatherChunk, planEntry, type PendingEntry } from './gatherEngine.js'

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')

/** A never-gathered entry no scanner has touched. */
const entry = (id: string, body: string, over: Partial<PendingEntry> = {}): PendingEntry => ({
  id,
  created_at: '2026-09-01T12:00:00.000Z',
  body_markdown: body,
  body_hash: md5(body),
  gathered_hash: null,
  gathered_words_hash: null,
  gather_attempts: 0,
  prayer_scanned: false,
  concordance_scanned: false,
  embedded: false,
  ...over,
})

/** The same entry as it stands after one clean gather of `was`, now holding `body`. */
const edited = (id: string, was: string, body: string, over: Partial<PendingEntry> = {}) =>
  entry(id, body, {
    gathered_hash: md5(was),
    gathered_words_hash: md5(writerWords(was)),
    prayer_scanned: true,
    concordance_scanned: true,
    embedded: true,
    ...over,
  })

const VERSE = '\n\n```dayspring-scripture 11111111-1111-4111-8111-111111111111\nJohn 15:5\nI am the vine; you are the branches.\n```\n'

describe('planEntry', () => {
  it('a brand-new entry needs everything', () => {
    expect(planEntry(entry('a', 'Lord, keep her safe tonight.'))).toMatchObject({
      harvest: true,
      concordance: true,
      embed: true,
    })
  })

  it('a first gather trusts the marks the old scanners left — cut-over re-reads nothing', () => {
    const e = entry('a', 'Lord, keep her safe tonight.', { prayer_scanned: true, embedded: true })
    expect(planEntry(e)).toMatchObject({ harvest: false, concordance: true, embed: false })
  })

  it('an edit to the writer\'s words is read again by both', () => {
    const e = edited('a', 'Lord, keep her safe.', 'Lord, keep her safe. And Esther too.')
    expect(planEntry(e)).toMatchObject({ harvest: true, concordance: true, embed: true })
  })

  it('an edit that only added a Scripture fence never reaches the model', () => {
    const was = 'Lord, keep her safe tonight.'
    const e = edited('a', was, was + VERSE)
    expect(e.body_hash).not.toBe(md5(was)) // the body did change…
    expect(planEntry(e)).toMatchObject({ harvest: false, concordance: false, embed: true }) // …the words did not
  })

  it('a page emptied out is still harvested (that is what removes its old rows), but not embedded', () => {
    expect(planEntry(edited('a', 'Lord, keep her safe.', ''))).toMatchObject({
      harvest: true,
      embed: false,
    })
  })
})

function mockSb(pending: PendingEntry[], givenUp = 0) {
  const stamps: { id: string; body_hash: string; words_hash: string; ok: boolean }[][] = []
  const sb = {
    rpc(name: string, args: Record<string, unknown>) {
      if (name === 'gather_pending_entries') return Promise.resolve({ data: pending, error: null })
      if (name === 'gather_stamp') {
        stamps.push(args.p_rows as never)
        expect(args.p_max_attempts).toBe(GATHER_MAX_ATTEMPTS)
        return Promise.resolve({ data: givenUp, error: null })
      }
      throw new Error(`unexpected rpc ${name}`)
    },
  }
  vi.mocked(supabaseAdmin).mockReturnValue(sb as never)
  return { stamps }
}

const harvestOk = (failedIds: string[] = []) => ({
  scanned: 0,
  candidates: 0,
  planted: 1,
  failed: failedIds.length,
  failedIds,
})
const extractOk = (failedIds: string[] = []) => ({ scanned: 0, merged: 2, failed: failedIds.length, failedIds })
const ids = (calls: unknown[][], arg: number) =>
  calls.map((c) => (c[arg] as { id: string }[]).map((e) => e.id))

beforeEach(() => {
  vi.mocked(deriveEntries).mockReset().mockResolvedValue({ items: 0, refs: 0, foreign: 0 })
  vi.mocked(embedEntries).mockReset().mockResolvedValue(undefined)
  vi.mocked(harvestEntries).mockReset().mockResolvedValue(harvestOk())
  vi.mocked(scanConcordanceEntries).mockReset().mockResolvedValue(extractOk())
})

describe('gatherChunk', () => {
  it('reads each entry once and stamps the hash of the body it read', async () => {
    const a = entry('a', 'Lord, keep her safe tonight.')
    const b = entry('b', 'Bought milk. Called Esther.')
    const { stamps } = mockSb([a, b])

    const out = await gatherChunk('owner', { settleMinutes: 30, source: 'repetition' })

    expect(ids(vi.mocked(deriveEntries).mock.calls, 2)).toEqual([['a', 'b']])
    expect(ids(vi.mocked(embedEntries).mock.calls, 1)).toEqual([['a', 'b']])
    expect(ids(vi.mocked(harvestEntries).mock.calls, 1)).toEqual([['a', 'b']])
    expect(ids(vi.mocked(scanConcordanceEntries).mock.calls, 1)).toEqual([['a', 'b']])
    expect(stamps).toEqual([
      [
        { id: 'a', body_hash: a.body_hash, words_hash: md5(writerWords(a.body_markdown)), ok: true },
        { id: 'b', body_hash: b.body_hash, words_hash: md5(writerWords(b.body_markdown)), ok: true },
      ],
    ])
    expect(out).toMatchObject({ read: 2, gathered: 2, failed: 0, modelSkipped: 0 })
  })

  it('a fence-only edit is derived, re-embedded and stamped without one model call', async () => {
    const was = 'Lord, keep her safe tonight.'
    const e = edited('a', was, was + VERSE)
    const { stamps } = mockSb([e])

    const out = await gatherChunk('owner', { settleMinutes: 30, source: 'repetition' })

    expect(harvestEntries).not.toHaveBeenCalled()
    expect(scanConcordanceEntries).not.toHaveBeenCalled()
    expect(deriveEntries).toHaveBeenCalledTimes(1)
    expect(ids(vi.mocked(embedEntries).mock.calls, 1)).toEqual([['a']])
    expect(stamps[0]).toEqual([expect.objectContaining({ id: 'a', ok: true })])
    expect(out).toMatchObject({ gathered: 1, modelSkipped: 1 })
  })

  it('an entry on a retry is sent alone, so it cannot fail its batch-mates again', async () => {
    mockSb([entry('fresh1', 'Lord, one.'), entry('retry', 'Lord, two.', { gather_attempts: 1 }), entry('fresh2', 'Lord, three.')])

    await gatherChunk('owner', { settleMinutes: 30, source: 'repetition' })

    expect(ids(vi.mocked(harvestEntries).mock.calls, 1)).toEqual([['fresh1', 'fresh2'], ['retry']])
    expect(ids(vi.mocked(scanConcordanceEntries).mock.calls, 1)).toEqual([['fresh1', 'fresh2'], ['retry']])
  })

  it('a model failure on some entries counts an attempt on those, and stamps the rest', async () => {
    const { stamps } = mockSb([entry('a', 'Lord, one.'), entry('b', 'Lord, two.')], 0)
    vi.mocked(scanConcordanceEntries).mockResolvedValue(extractOk(['b']))

    const out = await gatherChunk('owner', { settleMinutes: 30, source: 'repetition' })

    expect(stamps[0]!.map((r) => [r.id, r.ok])).toEqual([
      ['a', true],
      ['b', false],
    ])
    expect(out).toMatchObject({ read: 2, gathered: 1, failed: 1 })
  })

  it('an outage is not charged to the entries: nothing read means throw, with no attempt counted', async () => {
    const was = 'Lord, keep her safe tonight.'
    const { stamps } = mockSb([entry('a', 'Lord, one.'), entry('b', 'Lord, two.'), edited('fence', was, was + VERSE)])
    vi.mocked(harvestEntries).mockResolvedValue(harvestOk(['a', 'b']))

    await expect(gatherChunk('owner', { settleMinutes: 30, source: 'repetition' })).rejects.toThrow(
      /all 2 entries/,
    )
    // the fence-only edit asked nothing of the model, so it still lands
    expect(stamps).toEqual([[expect.objectContaining({ id: 'fence', ok: true })]])
  })

  it('an import passes its provenance to the Concordance and waits for nothing to settle', async () => {
    const rpc = vi.fn((name: string) =>
      Promise.resolve({ data: name === 'gather_pending_entries' ? [entry('a', 'Called Esther.')] : 0, error: null }),
    )
    vi.mocked(supabaseAdmin).mockReturnValue({ rpc } as never)

    await gatherChunk('owner', { settleMinutes: 0, source: 'import' })

    expect(rpc.mock.calls[0]).toEqual([
      'gather_pending_entries',
      { p_owner: 'owner', p_settle: '0 minutes', p_limit: 48 },
    ])
    expect(vi.mocked(scanConcordanceEntries).mock.calls[0]?.[2]).toBe('import')
  })

  it('an empty queue touches nothing', async () => {
    const { stamps } = mockSb([])
    const out = await gatherChunk('owner', { settleMinutes: 30, source: 'repetition' })
    expect(out.read).toBe(0)
    expect(deriveEntries).not.toHaveBeenCalled()
    expect(stamps).toEqual([])
  })
})
