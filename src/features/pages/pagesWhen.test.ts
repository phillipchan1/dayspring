import { describe, expect, it } from 'vitest'
import { grainSpan, maxOffsetFor, offsetOf, stepTo, whenOf } from './pagesWhen'

/** Jan 2024 → Oct 2026, the band's months (0-based months, as monthsAcross makes them). */
const MONTHS = Array.from({ length: 34 }, (_, i) => ({ year: 2024 + Math.floor(i / 12), month: i % 12 }))
const NOW = new Date('2026-10-10T12:00:00.000Z')
const idx = (year: number, month: number) => MONTHS.findIndex((m) => m.year === year && m.month === month)

describe('grainSpan', () => {
  it('brackets the calendar month, named season and year on the band', () => {
    expect(grainSpan('month', MONTHS, 0, NOW)).toEqual({ from: idx(2026, 9), to: idx(2026, 9) })
    expect(grainSpan('season', MONTHS, 0, NOW)).toEqual({ from: idx(2026, 8), to: idx(2026, 9) })
    expect(grainSpan('season', MONTHS, 1, NOW)).toEqual({ from: idx(2026, 5), to: idx(2026, 7) })
    expect(grainSpan('year', MONTHS, 1, NOW)).toEqual({ from: idx(2025, 0), to: idx(2025, 11) })
  })

  it('has nothing to bracket before the archive begins', () => {
    expect(grainSpan('year', MONTHS, 3, NOW)).toBeNull()
  })
})

describe('whenOf', () => {
  it('reads no bracket as all time', () => {
    expect(whenOf(null, MONTHS, NOW)).toEqual({ span: 'all', offset: 0 })
  })

  it('names a bracket a calendar would, with how far back it is', () => {
    expect(whenOf({ from: idx(2026, 5), to: idx(2026, 7) }, MONTHS, NOW)).toEqual({ span: 'season', offset: 1 })
    expect(whenOf({ from: idx(2026, 7), to: idx(2026, 7) }, MONTHS, NOW)).toEqual({ span: 'month', offset: 2 })
    expect(whenOf({ from: idx(2025, 0), to: idx(2025, 11) }, MONTHS, NOW)).toEqual({ span: 'year', offset: 1 })
  })

  it('lights no grain for a dragged run no calendar names', () => {
    expect(whenOf({ from: idx(2025, 3), to: idx(2025, 6) }, MONTHS, NOW)).toEqual({ span: null, offset: 0 })
  })
})

describe('stepping', () => {
  it('reaches back to the archive’s first period and no further', () => {
    expect(offsetOf('year', MONTHS[0]!, NOW)).toBe(2)
    expect(maxOffsetFor('year', MONTHS, NOW)).toBe(2)
    expect(maxOffsetFor('month', MONTHS, NOW)).toBe(33)
  })

  it('walks past a period the band has no months in', () => {
    const short = MONTHS.slice(0, 30) // ends Jun 2026: nothing in Jul–Oct
    expect(stepTo('month', short, 0, 1, NOW)).toEqual({ span: { from: 29, to: 29 }, offset: 4 })
    expect(stepTo('month', short, 0, -1, NOW)).toBeNull()
  })
})
