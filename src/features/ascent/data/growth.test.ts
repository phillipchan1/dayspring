import { describe, expect, it } from 'vitest'
import type { Rollup, RollupPayload } from '@/lib/insights'
import { monthGrowth, quarterGrowth, yearGrowth } from './growth'

function rollup(type: Rollup['type'], start: string, reflection: RollupPayload['reflection']): Rollup {
  return {
    id: `${type}-${start}`,
    type,
    period_start: start,
    period_end: start,
    source_ids: [],
    payload: {
      period: { type, start, end: start },
      quotes: [],
      facts: {} as RollupPayload['facts'],
      observation: null,
      topics: [],
      meta: {} as RollupPayload['meta'],
      ...(reflection ? { reflection } : {}),
    },
  }
}

const EV = { entry_id: 'e1', date: '2026-04-08', text: 'sent it without rereading it' }
const EV2 = { entry_id: 'e2', date: '2026-04-22', text: 'let it go to bed unfinished' }

describe('monthGrowth', () => {
  it('surfaces the gain prose with its verbatim evidence', () => {
    const g = monthGrowth(rollup('monthly', '2026-04-01', { gain: ['You stopped renegotiating.'], gainEvidence: [EV] }))
    expect(g?.movement).toEqual(['You stopped renegotiating.'])
    expect(g?.evidence[0]).toMatchObject({ entryId: 'e1', text: 'sent it without rereading it' })
  })

  it('measures ACROSS the period and never against a prior one', () => {
    const g = monthGrowth(rollup('monthly', '2026-04-01', { gain: ['moved'], gainEvidence: [EV] }))
    // The synthesis only ever sees its own period's children, so "vs. March"
    // would be a claim the data cannot support.
    expect(g?.acrossLabel).toContain('April')
    expect(g?.acrossLabel).not.toMatch(/vs\.|March/)
  })

  it('drops a gain claim that has no verbatim evidence under it', () => {
    expect(monthGrowth(rollup('monthly', '2026-04-01', { gain: ['You have grown a lot.'] }))).toBeNull()
    expect(monthGrowth(rollup('monthly', '2026-04-01', { gain: [], gainEvidence: [EV] }))).toBeNull()
  })

  it('orders evidence oldest first and caps it', () => {
    const g = monthGrowth(
      rollup('monthly', '2026-04-01', {
        gain: ['moved'],
        gainEvidence: [EV2, EV, { entry_id: 'e3', date: '2026-04-01', text: 'third' }, { entry_id: 'e4', date: '2026-04-30', text: 'fourth' }],
      }),
    )
    expect(g?.evidence.map((e) => e.date)).toEqual(['2026-04-01', '2026-04-08', '2026-04-22'])
  })

  it('carries gapWatch only when the model wrote one', () => {
    const withGap = monthGrowth(rollup('monthly', '2026-04-01', { gain: ['m'], gainEvidence: [EV], gapWatch: 'watch this' }))
    expect(withGap?.gapWatch).toBe('watch this')
    const without = monthGrowth(rollup('monthly', '2026-04-01', { gain: ['m'], gainEvidence: [EV] }))
    expect(without?.gapWatch).toBeNull()
  })

  it('returns null for a legacy rollup with no reflection block', () => {
    expect(monthGrowth(rollup('monthly', '2026-04-01', undefined))).toBeNull()
    expect(monthGrowth(undefined)).toBeNull()
  })
})

describe('quarterGrowth', () => {
  const pair = { id: 'p1', ask: EV, later: EV2 }

  it('reads tensions and ebenezer pairs off the quarterly tier', () => {
    const g = quarterGrowth(
      rollup('quarterly', '2026-04-01', {
        ebenezer: [pair],
        tensions: [{ id: 't1', thread: 'forcing vs. stewarding', question: 'Where is the line?' }],
      }),
    )
    expect(g?.pairs).toHaveLength(1)
    expect(g?.tensions[0]?.thread).toBe('forcing vs. stewarding')
  })

  it('never carries prose — at the Ridge the app asks and does not answer', () => {
    const g = quarterGrowth(rollup('quarterly', '2026-04-01', { tensions: [{ id: 't', thread: 'a', question: 'b?' }] }))
    expect(g?.movement).toEqual([])
    expect(g?.evidence).toEqual([])
  })

  it('drops a pair whose later moment does not follow its earlier ask', () => {
    const reversed = { id: 'p2', ask: EV2, later: EV }
    const sameDay = { id: 'p3', ask: EV, later: { ...EV, entry_id: 'e9' } }
    expect(quarterGrowth(rollup('quarterly', '2026-04-01', { ebenezer: [reversed, sameDay] }))).toBeNull()
  })

  it('drops a half-empty pair or tension', () => {
    const halfPair = { id: 'p4', ask: EV, later: { entry_id: '', date: '', text: '' } }
    const blankTension = { id: 't2', thread: 'a', question: '  ' }
    expect(
      quarterGrowth(rollup('quarterly', '2026-04-01', { ebenezer: [halfPair], tensions: [blankTension] })),
    ).toBeNull()
  })
})

describe('yearGrowth', () => {
  it('surfaces the throughline and the year label', () => {
    const g = yearGrowth(rollup('yearly', '2026-01-01', { throughline: ['A year ago you were…', 'Now you…'] }))
    expect(g?.movement).toHaveLength(2)
    expect(g?.acrossLabel).toBe('2026')
  })

  it('stands on stones alone when the throughline is empty', () => {
    const g = yearGrowth(rollup('yearly', '2026-01-01', { stones: [{ id: 's1', ask: EV, later: EV2 }] }))
    expect(g?.pairs).toHaveLength(1)
  })

  it('returns null when the year produced neither', () => {
    expect(yearGrowth(rollup('yearly', '2026-01-01', { themes: ['just themes'] }))).toBeNull()
  })
})
