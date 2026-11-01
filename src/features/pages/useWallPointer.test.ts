import { describe, expect, it } from 'vitest'
import { LIFT_MS, LONG_PRESS_MOVE_PX, holdBroken } from './useWallPointer'

describe('holdBroken', () => {
  const o = { x: 100, y: 100 }

  it('a finger that stays put is still holding', () => {
    expect(holdBroken(o, 100, 100)).toBe(false)
    expect(holdBroken(o, 104, 97)).toBe(false)
  })

  it('a finger that travels was a scroll — the card goes back at once', () => {
    expect(holdBroken(o, 100, 100 + LONG_PRESS_MOVE_PX + 1)).toBe(true)
    expect(holdBroken(o, 92, 108)).toBe(true)
  })
})

describe('the lift', () => {
  it('settles quickly enough to be a beat, not a state', () => {
    expect(LIFT_MS).toBeGreaterThan(150)
    expect(LIFT_MS).toBeLessThan(600)
  })
})
