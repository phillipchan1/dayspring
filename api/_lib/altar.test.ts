// Guards the two deterministic gates in the Altar's prose harvest.
//
// HARVEST_CUE is a cost control: an entry it doesn't match never reaches the
// model and is marked scanned, so its recall is a HARD CEILING on the Altar.
// No amount of prompt work recovers a prayer the prefilter refused to open.
// That makes its misses worth naming individually rather than tolerating as a
// rounding error.
//
// isVerbatim is the honesty gate. The Altar holds the writer's own words, and
// a paraphrase there would be Dayspring putting words in someone's mouth about
// their own prayers — so this fails closed.
//
// The prose comes from the shared recognition corpus (src/lib/recognition/),
// where the expected prayers are hand-labeled. Categories used here:
//   prayer-clear             — a prayer the cue should catch
//   prayer-cue-blind         — a genuine prayer the cue misses (the ceiling)
//   prayer-cue-false-positive / prayer-distractor — cue fires, no prayer
//   ordinary                 — no prayer, and the cue should stay quiet

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HARVEST_CUE, harvestBatch, harvestPlan, harvestPrayers, isVerbatim } from './altar.js'
import { callModel } from './openai.js'
import { supabaseAdmin } from './supabaseAdmin.js'

// Only harvestBatch / harvestPrayers tests drive the model; everything else here is pure.
vi.mock('./openai.js', () => ({ callModel: vi.fn() }))
vi.mock('./supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
import { CORPUS, corpusFor } from '../../src/lib/recognition/corpus/index.js'
import { scoreCuePrefilter } from '../../src/lib/recognition/score.js'

// Raise when a cue miss is fixed. Never lower.
//   2026-07-31  0.774  first measurement
//   2026-08-01  0.839  added father/abba/almighty/saviour
// The remaining ~0.16 is a ceiling, not a gap: those prayers name God nowhere,
// and a regex wide enough to catch them would fire on most of a journal. See the
// note on HARVEST_CUE in altar.ts for the alternative worth considering.
const CUE_RECALL_FLOOR = 0.83

const byId = (id: string) => CORPUS.find((e) => e.id === id)!
const fires = (text: string) => HARVEST_CUE.test(text)

describe('HARVEST_CUE', () => {
  it('opens every entry that holds a prayer it can see', () => {
    const missed = corpusFor('passages')
      .filter((e) => e.category === 'prayer-clear' && (e.passages ?? []).length > 0)
      .filter((e) => !fires(e.body))
      .map((e) => e.id)
    expect(missed).toEqual([])
  })

  it('stays quiet on ordinary prose', () => {
    // Every spurious match is a model call billed for a shopping list.
    const spurious = CORPUS.filter((e) => e.category === 'ordinary')
      .filter((e) => fires(e.body))
      .map((e) => e.id)
    expect(spurious).toEqual([])
  })

  it('REGRESSION (cue-blind-prayer): misses genuine prayers with no cue word', () => {
    // These are real prayers. The prefilter marks each entry scanned and the
    // model never sees it, so they can never reach the Altar. Frozen so that
    // widening the cue is a visible, deliberate act.
    const blind = CORPUS.filter((e) => e.category === 'prayer-cue-blind')
    expect(blind.length).toBeGreaterThan(0)
    for (const e of blind) {
      expect(fires(e.body), `${e.id} should be invisible to the cue`).toBe(false)
      expect((e.passages ?? []).length, `${e.id} should still hold a real prayer`).toBeGreaterThan(0)
    }
  })

  it('opens a prayer addressed to the Father', () => {
    // Until 2026-08-01 the list had 'holy spirit' but no term for 'father', so
    // a prayer opening "Father," was marked scanned and never read while the
    // identical prayer opening "Lord," was kept. Guard against losing it again.
    for (const address of ['Father', 'Abba', 'Almighty God', 'Saviour', 'Savior', 'Lord']) {
      expect(fires(`${address}, I don’t know how to lead this well.`), address).toBe(true)
    }
    expect(fires(byId('pra-clear-03').body)).toBe(true)
  })

  it('meets the recall floor, and names what it costs when it does not', () => {
    const score = scoreCuePrefilter(fires)
    expect(score.recall, `prayers the cue cannot see: ${score.missedIn.join(', ')}`).toBeGreaterThanOrEqual(
      CUE_RECALL_FLOOR,
    )
  })

  it('is generous by design, so its false positives are spend and not error', () => {
    // A cue-positive entry with no prayer costs one model call and yields
    // nothing — that is the intended trade, not a bug. Reported, never gated.
    const score = scoreCuePrefilter(fires)
    expect(score.fp).toBeGreaterThan(0)
    expect(score.precision).toBeLessThan(1)
  })
})

describe('isVerbatim', () => {
  const body = 'Lord, be near her tonight\nin the way she actually needs.'

  it('accepts an exact substring', () => {
    expect(isVerbatim(body, 'be near her tonight')).toBe(true)
  })

  it('accepts a span whose whitespace differs from the body', () => {
    // The corpus relies on this: a prayer that spans a line break is still the
    // writer's own contiguous words.
    expect(isVerbatim(body, 'be near her tonight in the way she actually needs.')).toBe(true)
  })

  it('rejects a paraphrase, however faithful', () => {
    expect(isVerbatim(body, 'be close to her this evening')).toBe(false)
  })

  it('rejects empty text', () => {
    expect(isVerbatim(body, '')).toBe(false)
  })

  it('accepts every hand-labeled passage in the corpus', () => {
    // If this ever fails, the corpus is lying and every prayer score with it —
    // the model would be marked wrong for returning the right span.
    const broken = corpusFor('passages').flatMap((e) =>
      (e.passages ?? []).filter((p) => !isVerbatim(e.body, p.text)).map((p) => `${e.id}: ${p.text.slice(0, 50)}`),
    )
    expect(broken).toEqual([])
  })
})

describe('harvestBatch — the writer\'s words, never the verse (Guardrail H3)', () => {
  it('drops a quoted verse the model proposes as a prayer, keeps the writer\'s own', async () => {
    const body = [
      '<!-- ritual:name:Lectio Divina -->',
      '<!-- ritual:section:Read -->',
      '```dayspring-scripture 7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44',
      'Father, glorify your name.',
      'John 12:28 · ESV',
      '```',
      '<!-- ritual:section:Meditate -->',
      '> Father, glorify your name',
      '',
      'Lord, glorify it in me today, even here.',
      '<!-- ritual:end -->',
    ].join('\n')
    vi.mocked(callModel).mockResolvedValueOnce({
      entries: [
        {
          id: 'e1',
          prayers: [
            { type: 'prayer', text: 'Father, glorify your name' },
            { type: 'prayer', text: 'Lord, glorify it in me today, even here.' },
          ],
        },
      ],
    })
    const out = await harvestBatch([{ id: 'e1', body }])
    expect(out?.get('e1')).toEqual([{ type: 'prayer', text: 'Lord, glorify it in me today, even here.' }])
    // …and the model was never shown the passage in the first place.
    const sent = JSON.stringify(vi.mocked(callModel).mock.calls[0]?.[1])
    expect(sent).not.toContain('glorify your name')
  })
})

type EntryRow = { id: string; created_at: string; body_markdown: string }

type ReconcileEntry = {
  entry_id: string
  created_at: string
  items: { type: string; content: string }[]
}

/**
 * A Supabase double whose `reconcile_scanned_items` behaves like the SQL one
 * (supabase/migrations/20260930120000_reconcile_scanned_items.sql): per entry it
 * drops scanned rows the harvest no longer returns, inserts only what is not
 * already there, and stamps the entry. `entries` is served back on EVERY read —
 * deliberately not filtered by the stamp — so two runs model two callers that
 * both read the same unscanned entries (the cron racing an import job).
 */
function mockSb(entries: EntryRow[]) {
  const inserts: Record<string, unknown>[] = []
  const rows: { entry_id: string; type: string; content: string }[] = []
  const scanned: string[][] = []
  const sb = {
    from() {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        range: () => chain,
        order: () => chain,
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          Promise.resolve({ data: entries, error: null }).then(resolve),
      }
      return chain
    },
    rpc(name: string, args: { p_owner: string; p_entries: ReconcileEntry[] }) {
      if (name !== 'reconcile_scanned_items') throw new Error(`unexpected rpc ${name}`)
      let planted = 0
      for (const e of args.p_entries) {
        const wanted = new Set(e.items.map((i) => `${i.type}\u0000${i.content}`))
        for (let k = rows.length - 1; k >= 0; k--) {
          const r = rows[k]!
          if (r.entry_id === e.entry_id && !wanted.has(`${r.type}\u0000${r.content}`)) rows.splice(k, 1)
        }
        for (const i of e.items) {
          if (rows.some((r) => r.entry_id === e.entry_id && r.type === i.type && r.content === i.content)) continue
          rows.push({ entry_id: e.entry_id, type: i.type, content: i.content })
          inserts.push({
            owner: args.p_owner,
            entry_id: e.entry_id,
            type: i.type,
            content: i.content,
            source: 'scanned',
            created_at: e.created_at,
          })
          planted++
        }
      }
      scanned.push(args.p_entries.map((e) => e.entry_id))
      return Promise.resolve({ data: planted, error: null })
    },
  }
  vi.mocked(supabaseAdmin).mockReturnValue(sb as never)
  return { inserts, rows, scanned }
}

describe('harvestPrayers / harvestPlan — cue vs gate', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    vi.mocked(callModel).mockReset()
  })

  afterEach(() => {
    for (const key of ['GATHER_MODE']) {
      const value = saved[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    delete saved.GATHER_MODE
    vi.mocked(callModel).mockReset()
  })

  function isolateMode(mode?: string) {
    saved.GATHER_MODE = process.env.GATHER_MODE
    if (mode === undefined) delete process.env.GATHER_MODE
    else process.env.GATHER_MODE = mode
  }

  it('flag off keeps the cue prefilter and 6-entry span batches', async () => {
    isolateMode(undefined)
    const cueNeg = {
      id: 'neg',
      created_at: '2026-01-05T12:00:00.000Z',
      body_markdown: 'Went to the store for milk.',
    }
    const cuePos = Array.from({ length: 7 }, (_, i) => ({
      id: `pos${i}`,
      created_at: '2026-01-05T12:00:00.000Z',
      body_markdown: `Lord, help me number ${i}.`,
    }))
    const { inserts, scanned } = mockSb([cueNeg, ...cuePos])
    vi.mocked(callModel).mockImplementation(async (_sys, input) => {
      const batch = (input as { entries: { id: string; text: string }[] }).entries
      return {
        entries: batch.map((e) => ({
          id: e.id,
          prayers: [{ type: 'prayer', text: e.text }],
        })),
      }
    })

    const plan = await harvestPlan('owner')
    expect(plan).toEqual({ unscanned: 8, candidates: 7 })

    const out = await harvestPrayers('owner')
    expect(out.candidates).toBe(7)
    const names = vi.mocked(callModel).mock.calls.map((c) => c[3])
    expect(names.every((n) => n === 'altar_harvest')).toBe(true)
    expect(names).toHaveLength(2)
    const sizes = vi.mocked(callModel).mock.calls.map(
      (c) => (c[1] as { entries: unknown[] }).entries.length,
    )
    expect(sizes).toEqual([6, 1])
    const sentIds = vi.mocked(callModel).mock.calls.flatMap(
      (c) => (c[1] as { entries: { id: string }[] }).entries.map((e) => e.id),
    )
    expect(sentIds).not.toContain('neg')
    expect(scanned.flat()).toContain('neg')
    expect(inserts).toHaveLength(7)
  })

  it('gate mode calls the model for cue-negative entries', async () => {
    isolateMode('gate')
    const cueNeg = {
      id: 'blind',
      created_at: '2026-01-05T12:00:00.000Z',
      body_markdown: 'Please just let her be okay tonight.',
    }
    mockSb([cueNeg])
    expect(HARVEST_CUE.test(cueNeg.body_markdown)).toBe(false)

    vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
      const batch = (input as { entries: { id: string; text: string }[] }).entries
      if (name === 'gather_gate') {
        return { entries: batch.map((e) => ({ id: e.id, contains_prayer: true, contains_sense: false })) }
      }
      return {
        entries: batch.map((e) => ({
          id: e.id,
          prayers: [{ type: 'prayer', text: e.text }],
        })),
      }
    })

    const plan = await harvestPlan('owner')
    expect(plan).toEqual({ unscanned: 1, candidates: 1 })

    const out = await harvestPrayers('owner')
    expect(out.candidates).toBe(1)
    expect(out.planted).toBe(1)
    const names = vi.mocked(callModel).mock.calls.map((c) => c[3])
    expect(names).toContain('gather_gate')
    expect(names).toContain('altar_harvest')
    const sentIds = vi.mocked(callModel).mock.calls.flatMap(
      (c) => (c[1] as { entries: { id: string }[] }).entries.map((e) => e.id),
    )
    expect(sentIds).toContain('blind')
  })

  it('a partial chunk failure leaves the entry unmarked with no rows inserted', async () => {
    isolateMode('gate')
    const body = Array.from(
      { length: 280 },
      (_, i) => `Sentence number ${String(i).padStart(3, '0')} is here with extra padding words.`,
    ).join(' ')
    const entry = { id: 'long', created_at: '2026-01-05T12:00:00.000Z', body_markdown: body }
    const { inserts, scanned } = mockSb([entry])
    let spanCalls = 0
    vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
      const batch = (input as { entries: { id: string; text: string }[] }).entries
      if (name === 'gather_gate') {
        return { entries: batch.map((e) => ({ id: e.id, contains_prayer: true, contains_sense: false })) }
      }
      spanCalls++
      if (spanCalls === 2) throw new Error('span failed')
      return {
        entries: batch.map((e) => ({
          id: e.id,
          prayers: [{ type: 'prayer', text: e.text.slice(0, 48) }],
        })),
      }
    })

    const out = await harvestPrayers('owner')
    expect(spanCalls).toBeGreaterThan(1)
    expect(inserts).toEqual([])
    expect(scanned.flat()).not.toContain('long')
    expect(out.planted).toBe(0)
    expect(out).toMatchObject({ scanned: 0, failed: 1 })
  })

  // REGRESSION (duplicate cairns): the harvest used to insert, then stamp, with no
  // dedupe. Two readers of the same unscanned entries — the daily cron and an
  // import's altar_harvest job, or one run retried after its stamp failed — each
  // inserted, and the tagger was billed for every duplicate line.
  for (const mode of [undefined, 'gate'] as const) {
    it(`two runs over the same unscanned entries plant each prayer once (${mode ?? 'cue'})`, async () => {
      isolateMode(mode)
      const entries = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        created_at: '2026-01-05T12:00:00.000Z',
        body_markdown: `Lord, help me number ${i}.`,
      }))
      const { inserts, rows } = mockSb(entries)
      vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
        const batch = (input as { entries: { id: string; text: string }[] }).entries
        if (name === 'gather_gate') {
          return { entries: batch.map((e) => ({ id: e.id, contains_prayer: true, contains_sense: false })) }
        }
        return { entries: batch.map((e) => ({ id: e.id, prayers: [{ type: 'prayer', text: e.text }] })) }
      })

      const first = await harvestPrayers('owner')
      const second = await harvestPrayers('owner')

      expect(first.planted).toBe(3)
      expect(second.planted).toBe(0)
      expect(inserts).toHaveLength(3)
      expect(rows.map((r) => r.entry_id).sort()).toEqual(['e0', 'e1', 'e2'])
    })
  }

  it('a re-read drops the passage the harvest no longer returns and keeps the rest', async () => {
    isolateMode(undefined)
    const entry = {
      id: 'e',
      created_at: '2026-01-05T12:00:00.000Z',
      body_markdown: 'Lord, keep her safe tonight. Father, give me patience with him.',
    }
    const { inserts, rows } = mockSb([entry])
    const answers = [
      ['Lord, keep her safe tonight.', 'Father, give me patience with him.'],
      ['Father, give me patience with him.'],
    ]
    vi.mocked(callModel).mockImplementation(async () => ({
      entries: [{ id: 'e', prayers: answers.shift()!.map((text) => ({ type: 'prayer', text })) }],
    }))

    await harvestPrayers('owner')
    await harvestPrayers('owner')

    expect(rows.map((r) => r.content)).toEqual(['Father, give me patience with him.'])
    // the surviving row was never re-inserted, so it keeps its id, tags and thread
    expect(inserts).toHaveLength(2)
  })

  // REGRESSION (job that never ends): a failed cue batch returned 0 and nothing
  // else, so a run that read nothing was indistinguishable from a quiet success.
  it('counts the entries a failed model call left unread, and does not stamp them', async () => {
    isolateMode(undefined)
    const quiet = { id: 'quiet', created_at: '2026-01-05T12:00:00.000Z', body_markdown: 'Bought milk.' }
    const prayers = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      created_at: '2026-01-05T12:00:00.000Z',
      body_markdown: `Lord, help me number ${i}.`,
    }))
    const { inserts, scanned } = mockSb([quiet, ...prayers])
    vi.mocked(callModel).mockRejectedValue(new Error('model down'))

    const out = await harvestPrayers('owner')

    expect(out).toMatchObject({ scanned: 1, candidates: 7, planted: 0, failed: 7 })
    expect(out.failedIds.sort()).toEqual(prayers.map((p) => p.id))
    expect(scanned.flat()).toEqual(['quiet'])
    expect(inserts).toEqual([])
  })
})
