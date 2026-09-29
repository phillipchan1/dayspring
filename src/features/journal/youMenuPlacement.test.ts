import { describe, expect, it } from 'vitest'
import { placeYouMenu, YOU_MENU_GUTTER, YOU_MENU_PREFERRED_WIDTH } from './youMenuPlacement'

/** The You tab on a phone is the last, `width: auto` control — measured 56px at 430. */
const PHONE_TRIGGER = 56

const phone = (viewportWidth: number) =>
  placeYouMenu({
    triggerLeft: viewportWidth - PHONE_TRIGGER,
    triggerRight: viewportWidth,
    viewportWidth,
  })

const inside = (box: { left: number; width: number }, viewportWidth: number, safeLeft = 0, safeRight = 0) => {
  const min = YOU_MENU_GUTTER + safeLeft
  const max = viewportWidth - YOU_MENU_GUTTER - safeRight
  expect(box.left).toBeGreaterThanOrEqual(min)
  expect(box.left + box.width).toBeLessThanOrEqual(max)
  expect(box.width).toBeGreaterThan(0)
}

describe('placeYouMenu', () => {
  it('pulls the measured 430px iPhone menu back onto the screen', () => {
    // Measured (PR #133 / App Review): left=374, width=268, right=642 — 212px clipped.
    const box = placeYouMenu({ triggerLeft: 374, triggerRight: 430, viewportWidth: 430 })
    expect(box).toEqual({ left: 154, width: 268 })
    inside(box, 430)
  })

  it('fits 320, 375 and 430 phone widths with an 8px gutter', () => {
    for (const vw of [320, 375, 430]) {
      const box = phone(vw)
      expect(box.width).toBe(YOU_MENU_PREFERRED_WIDTH)
      inside(box, vw)
    }
    expect(phone(320)).toEqual({ left: 44, width: 268 })
    expect(phone(375)).toEqual({ left: 99, width: 268 })
    expect(phone(430)).toEqual({ left: 154, width: 268 })
  })

  it('stays left-aligned to the rail trigger on iPad portrait', () => {
    const box = placeYouMenu({ triggerLeft: 16, triggerRight: 56, viewportWidth: 768 })
    expect(box).toEqual({ left: 16, width: 268 })
    inside(box, 768)
  })

  it('shrinks when safe-area insets leave less than 268px', () => {
    const box = placeYouMenu({
      triggerLeft: 264,
      triggerRight: 320,
      viewportWidth: 320,
      safeLeft: 44,
      safeRight: 44,
    })
    expect(box.width).toBe(320 - 2 * YOU_MENU_GUTTER - 88)
    inside(box, 320, 44, 44)
  })

  it('does not use a negative width on a pathological viewport', () => {
    const box = placeYouMenu({
      triggerLeft: 0,
      triggerRight: 20,
      viewportWidth: 10,
      safeLeft: 20,
      safeRight: 20,
    })
    expect(box.width).toBe(0)
  })
})
