import { describe, expect, it } from 'vitest'
import {
  normalizeHarvestContent,
  newSpansForEntry,
  parseAfter,
  runGatherRescan,
  type ExistingItem,
  type RescanEntry,
} from './gather-rescan.ts'

describe('normalizeHarvestContent', () => {
  it('lowercases, collapses whitespace, and strips punctuation', () => {
    expect(normalizeHarvestContent('  Lord,  be near her tonight. ')).toBe('lord be near her tonight')
    expect(normalizeHarvestContent('Lord, be near her tonight.')).toBe(
      normalizeHarvestContent('lord be near her tonight'),
    )
  })
})

describe('newSpansForEntry', () => {
  it('skips spans already present under the normalized key', () => {
    const existing = new Set(['e1::lord be near her tonight'])
    const fresh = newSpansForEntry(
      'e1',
      [
        { type: 'prayer', text: 'Lord, be near her tonight.' },
        { type: 'prayer', text: 'Please just let her be okay tonight.' },
      ],
      existing,
    )
    expect(fresh).toEqual([{ type: 'prayer', text: 'Please just let her be okay tonight.' }])
  })
})

describe('parseAfter', () => {
  it('accepts a uuid or a date', () => {
    expect(parseAfter('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toEqual({
      kind: 'id',
      value: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    })
    expect(parseAfter('2026-01-05')?.kind).toBe('date')
    expect(() => parseAfter('not-a-cursor')).toThrow()
  })
})

describe('runGatherRescan', () => {
  const E1 = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111'
  const E2 = 'aaaaaaaa-bbbb-4ccc-8ddd-222222222222'
  const entries: RescanEntry[] = [
    { id: E1, created_at: '2026-01-05T12:00:00.000Z', body_markdown: 'Lord, be near her tonight.' },
    { id: E2, created_at: '2026-01-06T12:00:00.000Z', body_markdown: 'Please just let her be okay tonight.' },
  ]

  function deps(existing: ExistingItem[], harvest = defaultHarvest) {
    const inserts: Record<string, unknown>[][] = []
    return {
      inserts,
      api: {
        fetchEntries: async () => entries,
        fetchExisting: async () => existing,
        insertRows: async (rows: Record<string, unknown>[]) => {
          inserts.push(rows)
        },
        gatherHarvest: harvest,
      },
    }
  }

  const defaultHarvest = async () => ({
    byEntry: new Map([
      [E1, [{ type: 'prayer' as const, text: 'Lord, be near her tonight.' }]],
      [E2, [{ type: 'prayer' as const, text: 'Please just let her be okay tonight.' }]],
    ]),
    failed: [] as string[],
    gate: new Map([
      [E1, { containsPrayer: true, containsSense: false }],
      [E2, { containsPrayer: true, containsSense: false }],
    ]),
  })

  it('dry-run (default) inserts nothing and still reports would-insert', async () => {
    const { inserts, api } = deps([])
    const out = await runGatherRescan({ owner: 'o', apply: false, downstream: false }, api)
    expect(inserts).toEqual([])
    expect(out.dryRun).toBe(true)
    expect(out.wouldInsert).toBe(2)
    expect(out.inserted).toBe(0)
    expect(out.gatePositive).toBe(2)
    expect(out.nextCursor).toEqual({ id: E2, created_at: '2026-01-06T12:00:00.000Z' })
  })

  it('apply inserts only non-duplicate spans', async () => {
    const { inserts, api } = deps([
      { entry_id: E1, content: 'Lord,  be near her tonight!' },
    ])
    const out = await runGatherRescan({ owner: 'o', apply: true, downstream: false }, api)
    expect(out.inserted).toBe(1)
    expect(out.skippedDuplicate).toBe(1)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toEqual([
      {
        owner: 'o',
        entry_id: E2,
        type: 'prayer',
        content: 'Please just let her be okay tonight.',
        source: 'scanned',
        created_at: '2026-01-06T12:00:00.000Z',
      },
    ])
  })

  it('honors --after and --max and does not mark scanned', async () => {
    const { inserts, api } = deps([])
    const out = await runGatherRescan(
      { owner: 'o', apply: true, downstream: false, after: E1, max: 1 },
      api,
    )
    expect(out.entriesRead).toBe(1)
    expect(out.nextCursor?.id).toBe(E2)
    expect(inserts[0]?.every((r) => r.entry_id === E2)).toBe(true)
  })
})
