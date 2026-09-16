import { describe, expect, it } from 'vitest'
import { grainLabel, grainWindow, mondayOf, seasonIndex, spanStartMs, spanWindow } from './period'

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

  it('runs the season over the whole calendar quarter, not 90 trailing days', () => {
    const w = grainWindow('season', NOW)
    expect(iso(w.from)).toBe('2026-07-01T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-09-30T23:59:59.999Z')
  })

  it('runs the year Jan 1 → Dec 31, past today', () => {
    const w = grainWindow('year', NOW)
    expect(iso(w.from)).toBe('2026-01-01T00:00:00.000Z')
    expect(iso(w.to)).toBe('2026-12-31T23:59:59.999Z')
  })

  it('nests exactly: week inside month inside season inside year', () => {
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

  it('anchors the long spans to whole calendar years', () => {
    const w = spanWindow('5y', NOW)
    expect(iso(w.from!)).toBe('2022-01-01T00:00:00.000Z')
    expect(iso(w.to!)).toBe('2026-12-31T23:59:59.999Z')
  })

  it('passes a grain straight through', () => {
    expect(spanWindow('season', NOW)).toEqual(grainWindow('season', NOW))
  })
})

describe('grainLabel', () => {
  it('names each period so it reads the same on every surface', () => {
    expect(grainLabel('week', NOW)).toBe('Sep 14 – Sep 20')
    expect(grainLabel('month', NOW)).toBe('September 2026')
    expect(grainLabel('season', NOW)).toBe('Jul – Sep 2026')
    expect(grainLabel('year', NOW)).toBe('2026')
  })
})
