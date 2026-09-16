import { describe, expect, it } from 'vitest'
import { currentYear, isFirstOfMonth, isFirstOfYear, previousMonth, previousYear } from './dates.js'

describe('currentYear', () => {
  it('is the WHOLE calendar year, not the year to date', () => {
    // The row identity has to stay Jan 1 → Dec 31 across every rebuild, or the
    // open year leaves twelve partial rows behind instead of upserting one.
    expect(currentYear(new Date('2026-09-15T12:00:00Z'))).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
    expect(currentYear(new Date('2026-01-01T00:00:00Z'))).toEqual(currentYear(new Date('2026-12-31T23:00:00Z')))
  })

  it('is a different year from previousYear, so the two branches never collide', () => {
    const now = new Date('2026-01-01T08:00:00Z')
    expect(isFirstOfYear(now)).toBe(true)
    expect(previousYear(now).start).toBe('2025-01-01')
    expect(currentYear(now).start).toBe('2026-01-01')
  })
})

describe('the monthly cadence that keeps the open year moving', () => {
  it('fires on the 1st, when the month it reads has just sealed', () => {
    const first = new Date('2026-10-01T08:00:00Z')
    expect(isFirstOfMonth(first)).toBe(true)
    expect(previousMonth(first)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    // …and the year it then rebuilds is the one that month belongs to.
    expect(currentYear(first).start).toBe('2026-01-01')
  })

  it('does not fire on any other day', () => {
    expect(isFirstOfMonth(new Date('2026-10-02T08:00:00Z'))).toBe(false)
  })
})
