import { describe, expect, it } from 'vitest'
import { cameraFor, elev, tOf, tween } from './mountain'

describe('one mountain', () => {
  it('puts Jan 1 at the foot and the peak at the year’s end', () => {
    expect(tOf('2026-01-01', 2026)).toBe(0)
    expect(tOf('2027-01-01', 2026)).toBe(1)
    expect(tOf('2025-12-15', 2026)).toBeLessThan(0) // winter starts on the ground before the climb
    expect(elev(1)).toBeGreaterThan(elev(0.75))
    expect(elev(1)).toBeGreaterThan(elev(1.1)) // the far side falls away
  })

  it('frames each period inside its camera, the year seeing the peak', () => {
    const week = cameraFor('week', '2026-09-21', '2026-09-27', 2026)
    expect(week.t0).toBeLessThan(tOf('2026-09-21', 2026))
    expect(week.t1).toBeGreaterThan(tOf('2026-09-28', 2026))
    const year = cameraFor('year', '2026-01-01', '2026-12-31', 2026)
    expect(year.t0).toBeLessThan(0)
    expect(year.t1).toBeGreaterThan(1)
    expect(year.t1 - year.t0).toBeGreaterThan((week.t1 - week.t0) * 40)
  })

  it('tweens between cameras from one end to the other', () => {
    const a = cameraFor('week', '2026-09-21', '2026-09-27', 2026)
    const b = cameraFor('year', '2026-01-01', '2026-12-31', 2026)
    expect(tween(a, b, 0).t0).toBeCloseTo(a.t0)
    expect(tween(a, b, 1).t1).toBeCloseTo(b.t1)
  })
})
