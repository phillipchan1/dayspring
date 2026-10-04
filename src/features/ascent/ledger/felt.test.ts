import { describe, expect, it } from 'vitest'
import { feltIn, KEEP_EMOTIONS, LINES_PER_EMOTION, MIN_INTENSITY, monthsOf, type ReadInput } from './felt'

const page = (id: string, date: string) => ({ id, created_at: `${date}T12:00:00Z` })
const read = (entryId: string, ...emotions: [string, number, string][]): ReadInput => ({
  entryId,
  emotions: emotions.map(([emotion, intensity, quote]) => ({ emotion, intensity, quote })),
})

const FALL = { from: '2026-09-01', to: '2026-11-30' }
const SUMMER = { from: '2026-06-01', to: '2026-08-31' }

describe('monthsOf', () => {
  it('names every month a span touches, across a year boundary', () => {
    expect(monthsOf({ from: '2025-12-01', to: '2026-02-28' })).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(monthsOf({ from: '2026-10-01', to: '2026-10-04' })).toEqual(['2026-10'])
  })
})

describe('feltIn', () => {
  const entries = [
    page('a', '2026-09-03'),
    page('b', '2026-10-10'),
    page('c', '2026-10-20'),
    page('d', '2026-07-01'), // summer
    page('e', '2026-11-02'), // no read
  ]
  const reads = [
    read('a', ['stress', 0.8, 'so pressured'], ['joy', 0.5, 'laughed with the kids']),
    read('b', ['stress', 0.6, 'tight in my chest']),
    read('c', ['stress', 0.9, 'overwhelmed'], ['peace', 0.2, 'a little calmer']),
    read('d', ['joy', 0.7, 'the light in Lisbon']),
  ]

  it('orders by pages carrying it, and keeps the writer’s strongest lines verbatim', () => {
    const felt = feltIn(entries, reads, FALL)
    expect(felt.months).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(felt.read).toBe(3)
    expect(felt.emotions.map((e) => e.emotion)).toEqual(['stress', 'joy'])
    const stress = felt.emotions[0]!
    expect(stress.pages).toBe(3)
    expect(stress.perMonth).toEqual([1, 2, 0])
    expect(stress.lines).toEqual([
      { entryId: 'c', date: '2026-10-20', text: 'overwhelmed' },
      { entryId: 'a', date: '2026-09-03', text: 'so pressured' },
    ])
    expect(stress.lines).toHaveLength(LINES_PER_EMOTION)
  })

  it('leaves out the read’s faintest guesses', () => {
    const felt = feltIn(entries, reads, FALL)
    expect(0.2).toBeLessThan(MIN_INTENSITY)
    expect(felt.emotions.find((e) => e.emotion === 'peace')).toBeUndefined()
  })

  it('says whether each was there in the span before — a date fact, nothing more', () => {
    const felt = feltIn(entries, reads, FALL, SUMMER)
    expect(felt.emotions.find((e) => e.emotion === 'joy')?.before).toBe(true)
    expect(felt.emotions.find((e) => e.emotion === 'stress')?.before).toBe(false)
    expect(feltIn(entries, reads, FALL).emotions[0]?.before).toBeNull()
  })

  it('is empty, not invented, for pages with no read', () => {
    const felt = feltIn([page('x', '2026-10-01')], reads, FALL)
    expect(felt).toEqual({ months: ['2026-09', '2026-10', '2026-11'], read: 0, emotions: [] })
  })

  it('keeps a bounded handful', () => {
    const many = Array.from({ length: 10 }, (_, i) => `emotion${i}`)
    const felt = feltIn([page('a', '2026-10-01')], [read('a', ...many.map((m): [string, number, string] => [m, 0.5, 'words']))], FALL)
    expect(felt.emotions).toHaveLength(KEEP_EMOTIONS)
  })

  it('carries no score: nothing on the result averages or grades the span', () => {
    const felt = feltIn(entries, reads, FALL)
    expect(Object.keys(felt).sort()).toEqual(['emotions', 'months', 'read'])
    expect(Object.keys(felt.emotions[0]!).sort()).toEqual(['before', 'emotion', 'lines', 'pages', 'perMonth'])
  })
})
