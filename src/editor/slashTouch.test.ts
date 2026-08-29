import { describe, expect, it } from 'vitest'
import { isTapGesture, TAP_SLOP } from './slashTouch'

describe('isTapGesture', () => {
  const at = (x: number, y: number) => ({ x, y })

  it('counts a finger that barely moved as a tap', () => {
    expect(isTapGesture(at(40, 80), at(40, 80))).toBe(true)
    expect(isTapGesture(at(40, 80), at(44, 86))).toBe(true)
    expect(isTapGesture(at(40, 80), at(40 + TAP_SLOP, 80))).toBe(true)
  })

  it('does not count a scroll as a tap', () => {
    // The first finger-down on a row used to fire that row on lift,
    // which closed the sheet before anyone could pick from it.
    expect(isTapGesture(at(40, 200), at(40, 140))).toBe(false)
    expect(isTapGesture(at(40, 80), at(40, 80 + TAP_SLOP + 1))).toBe(false)
    expect(isTapGesture(at(40, 80), at(80, 84))).toBe(false)
  })
})
