import { describe, expect, it } from 'vitest'
import { monthStrip, seasonStrip, weekLabel, weekStrip } from './strips'
import { seasonOf } from './seasons'

describe('where we stand', () => {
  it('lays out the week Monday to Sunday and names its close by date', () => {
    const s = weekStrip('2026-09-23') // a Wednesday
    expect(s.cells.map((c) => c.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(s.nowIx).toBe(2)
    expect(s.note).toBe('It’s Wednesday. This week is still being written — it closes Sunday, Sep 27.')
    expect(weekLabel('2026-09-23')).toBe('Sep 21 – 27')
    expect(weekLabel('2026-10-01')).toBe('Sep 28 – Oct 4')
    expect(weekStrip('2026-09-27').nowIx).toBe(6) // Sunday is the week's last day
  })

  it('marks the day of the month, and a past month as closed', () => {
    const open = monthStrip('2026-09', '2026-09-21')
    expect(open.cells).toHaveLength(30)
    expect(open.nowIx).toBe(20)
    expect(open.note).toBe('It’s the 21st. September is still being written — it closes on the 30th.')
    const shut = monthStrip('2026-08', '2026-09-21')
    expect(shut.nowIx).toBe(31)
    expect(shut.note).toBe('August closed on the 31st.')
    expect(monthStrip('2026-09', '2026-09-12').note).toContain('the 12th')
  })

  it('places now inside the season, winter crossing the year', () => {
    const fall = seasonStrip(seasonOf('2026-09-21'), '2026-09-21')
    expect(fall.cells.map((c) => c.label)).toEqual(['Sep', 'Oct', 'Nov'])
    expect(fall.nowIx).toBe(0)
    expect(fall.nowFill).toBeGreaterThan(0.6)
    expect(fall.note).toBe('It’s September, the first month of fall. Fall is still being written — it closes Nov 30.')
    const winter = seasonStrip(seasonOf('2026-01-10'), '2026-01-10')
    expect(winter.cells.map((c) => c.key)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(winter.nowIx).toBe(1)
    expect(seasonStrip(seasonOf('2026-07-01'), '2026-09-21').note).toBe('Summer 2026 closed on Aug 31.')
  })
})
