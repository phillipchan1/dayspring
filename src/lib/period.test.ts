// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  carryPeriod,
  grainLabel,
  grainWindow,
  mondayOf,
  onCarriedPeriod,
  periodEyebrow,
  periodName,
  periodWindow,
  quarterWindow,
  readCarriedOffset,
  seasonIndex,
  spanStartMs,
  spanWindow,
  spanWindowAt,
} from './period'

/** A Tuesday, mid-quarter, mid-year — nothing lands on a boundary by accident. */
const NOW = new Date('2026-09-15T14:32:00.000Z')

function iso(d: Date): string {
  return d.toISOString()
}

describe('grainWindow', () => {
  it('runs the week Monday 00:00Z → Sunday 23:59Z', () => {
    const w = grainWindow('week', NOW)
    expect(iso(w.from)).toBe('2026-09-14T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-09-20T23:59:59.999Z')
  })

  it('treats Sunday as the END of its week, not the start', () => {
    const sunday = new Date('2026-09-20T09:00:00.000Z')
    expect(iso(mondayOf(sunday))).toBe('2026-09-14T00:00:00.000Z')
  })

  it('runs the month first → last of the calendar month', () => {
    const w = grainWindow('month', NOW)
    expect(iso(w.from)).toBe('2026-09-01T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-09-30T23:59:59.999Z')
  })

  it('runs the season over the named season, not a quarter or 90 trailing days', () => {
    const w = grainWindow('season', NOW)
    expect(iso(w.from)).toBe('2026-09-01T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-11-30T23:59:59.999Z')
  })

  it('lets winter straddle New Year, from either side of it', () => {
    for (const day of ['2025-12-20T12:00:00.000Z', '2026-01-15T12:00:00.000Z', '2026-02-28T12:00:00.000Z']) {
      const w = grainWindow('season', new Date(day))
      expect(iso(w.from)).toBe('2025-12-01T00:00:00.000Z')
      expect(iso(w.to)).toBe('2026-02-28T23:59:59.999Z')
    }
  })

  it('keeps the rollup quarter on the calendar quarter', () => {
    const w = quarterWindow(NOW)
    expect(iso(w.from)).toBe('2026-07-01T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-09-30T23:59:59.999Z')
  })

  it('runs the year Jan 1 → Dec 31, past today', () => {
    const w = grainWindow('year', NOW)
    expect(iso(w.from)).toBe('2026-01-01T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-12-31T23:59:59.999Z')
  })

  it('nests: week inside month inside season inside year (outside winter)', () => {
    const week = grainWindow('week', NOW)
    const month = grainWindow('month', NOW)
    const season = grainWindow('season', NOW)
    const year = grainWindow('year', NOW)
    expect(week.from.getTime()).toBeGreaterThanOrEqual(month.from.getTime())
    expect(month.from.getTime()).toBeGreaterThanOrEqual(season.from.getTime())
    expect(season.from.getTime()).toBeGreaterThanOrEqual(year.from.getTime())
    expect(week.to.getTime()).toBeLessThanOrEqual(month.to.getTime())
    expect(month.to.getTime()).toBeLessThanOrEqual(season.to.getTime())
    expect(season.to.getTime()).toBeLessThanOrEqual(year.to.getTime())
  })

  it('rolls a week that spans two months back across the boundary', () => {
    const w = grainWindow('week', new Date('2026-04-01T10:00:00.000Z')) // a Wednesday
    expect(iso(w.from)).toBe('2026-03-30T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-04-05T23:59:59.999Z')
  })
})

describe('seasonIndex', () => {
  it('groups the calendar quarters', () => {
    expect([0, 1, 2].map(seasonIndex)).toEqual([0, 0, 0])
    expect([3, 4, 5].map(seasonIndex)).toEqual([1, 1, 1])
    expect(seasonIndex(11)).toBe(3)
  })
})

describe('spanWindow', () => {
  it('leaves the all-time field unbounded', () => {
    expect(spanWindow('all', NOW)).toEqual({})
    expect(spanStartMs('all', NOW)).toBe(-Infinity)
  })

  it('passes a grain straight through', () => {
    expect(spanWindow('season', NOW)).toEqual(grainWindow('season', NOW))
  })
})

describe('grainLabel', () => {
  it('names each period so it reads the same on every surface', () => {
    expect(grainLabel('week', NOW)).toBe('Sep 14 – 20')
    expect(grainLabel('month', NOW)).toBe('September 2026')
    expect(grainLabel('season', NOW)).toBe('Fall 2026')
    expect(grainLabel('year', NOW)).toBe('2026')
  })
})

describe('periodWindow', () => {
  it('is the current period at offset 0', () => {
    for (const g of ['week', 'month', 'season', 'year'] as const) {
      expect(periodWindow(g, 0, NOW)).toEqual(grainWindow(g, NOW))
    }
  })

  it('steps back one whole period at a time', () => {
    expect(iso(periodWindow('week', 1, NOW).from)).toBe('2026-09-07T00:00:00.000Z')
    expect(iso(periodWindow('month', 1, NOW).from)).toBe('2026-08-01T00:00:00.000Z')
    expect(iso(periodWindow('month', 9, NOW).from)).toBe('2025-12-01T00:00:00.000Z')
    expect(iso(periodWindow('season', 1, NOW).from)).toBe('2026-06-01T00:00:00.000Z')
    expect(iso(periodWindow('year', 3, NOW).from)).toBe('2023-01-01T00:00:00.000Z')
  })

  it('steps back across New Year into winter and out of it', () => {
    const winter = periodWindow('season', 3, NOW)
    expect(iso(winter.from)).toBe('2025-12-01T00:00:00.000Z')
    expect(iso(winter.to)).toBe('2026-02-28T23:59:59.999Z')
    expect(iso(periodWindow('season', 4, NOW).from)).toBe('2025-09-01T00:00:00.000Z')
  })

  it('leaves all-time unbounded at any offset', () => {
    expect(spanWindowAt('all', 4, NOW)).toEqual({})
  })
})

describe('periodName', () => {
  it('says a past period the way a calendar would', () => {
    expect(periodName('week', 1, NOW)).toBe('Sep 7 – 13')
    expect(periodName('week', 2, NOW)).toBe('Aug 31 – Sep 6')
    expect(periodName('month', 1, NOW)).toBe('August 2026')
    expect(periodName('season', 1, NOW)).toBe('Summer 2026')
    expect(periodName('season', 3, NOW)).toBe('Winter 2025–26')
    expect(periodName('year', 1, NOW)).toBe('2025')
  })

  it('adds the year to a week from another year', () => {
    const jan = new Date('2026-01-06T12:00:00.000Z')
    expect(periodName('week', 1, jan)).toBe('Dec 29 – Jan 4')
    expect(periodName('week', 2, jan)).toBe('Dec 22 – 28, 2025')
  })
})

describe('periodEyebrow', () => {
  it('says "this" for the current period and the grain for a past one', () => {
    expect(periodEyebrow('season', 0, NOW)).toBe('This season · Fall 2026')
    expect(periodEyebrow('season', 1, NOW)).toBe('Season · Summer 2026')
    expect(periodEyebrow('week', 0, NOW)).toBe('This week · Sep 14 – 20')
    expect(periodEyebrow('all', 0, NOW)).toBe('All time')
  })
})

describe('the carried offset', () => {
  it('travels with the period in the event, and resets for all-time', () => {
    const seen: [string, number][] = []
    const off = onCarriedPeriod((span, offset) => seen.push([span, offset]))
    carryPeriod('season', 2)
    expect(readCarriedOffset()).toBe(2)
    carryPeriod('all', 5)
    expect(readCarriedOffset()).toBe(0)
    off()
    expect(seen).toEqual([
      ['season', 2],
      ['all', 0],
    ])
  })
})
