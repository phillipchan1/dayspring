import { describe, expect, it } from 'vitest'
import { nextSeason, previousSeason, recentSeasons, seasonOf } from './seasons'

describe('seasons', () => {
  it('names the season a date is in', () => {
    expect(seasonOf('2026-09-21').label).toBe('Fall 2026')
    expect(seasonOf('2026-06-01').label).toBe('Summer 2026')
    expect(seasonOf('2026-05-31').label).toBe('Spring 2026')
  })

  it('lets winter cross the new year', () => {
    const dec = seasonOf('2025-12-24')
    const feb = seasonOf('2026-02-28')
    expect(dec.key).toBe('winter-2025')
    expect(feb.key).toBe('winter-2025')
    expect(dec.label).toBe('Winter 2025–26')
    expect(dec.from).toBe('2025-12-01')
    expect(dec.to).toBe('2026-02-28')
    expect(seasonOf('2028-02-15').to).toBe('2028-02-29') // leap year
  })

  it('steps back and forward through the year', () => {
    const fall = seasonOf('2026-10-01')
    expect(previousSeason(fall).label).toBe('Summer 2026')
    expect(previousSeason(seasonOf('2026-03-10')).label).toBe('Winter 2025–26')
    expect(nextSeason(seasonOf('2025-12-10')).label).toBe('Spring 2026')
    expect(recentSeasons('2026-09-21', 4).map((s) => s.label)).toEqual([
      'Winter 2025–26',
      'Spring 2026',
      'Summer 2026',
      'Fall 2026',
    ])
  })

  it('swaps the names in the southern hemisphere', () => {
    expect(seasonOf('2026-12-25', 'south').name).toBe('summer')
    expect(seasonOf('2026-07-01', 'south').name).toBe('winter')
  })
})
