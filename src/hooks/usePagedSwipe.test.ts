import { describe, expect, it } from 'vitest'
import {
  FLICK_BACK,
  PAGE_TURN_PX,
  pageDragOffset,
  rubberBand,
  settleDurationMs,
  SETTLE_MIN_MS,
  SETTLE_MS,
  settlePage,
} from './usePagedSwipe'

/** An iPhone's width — what these rules are tuned to. */
const PHONE = 375

describe('rubberBand', () => {
  it('gives readily at first and ever less after', () => {
    const small = rubberBand(20, PHONE)
    const large = rubberBand(200, PHONE)
    expect(small).toBeGreaterThan(0)
    expect(small).toBeLessThan(20)
    // Ten times the pull is nowhere near ten times the travel.
    expect(large).toBeLessThan(small * 10)
  })

  it('never reaches the dimension, however far the finger goes', () => {
    expect(rubberBand(10_000, PHONE)).toBeLessThan(PHONE)
  })

  it('keeps the sign and is zero at rest', () => {
    expect(rubberBand(-80, PHONE)).toBe(-rubberBand(80, PHONE))
    expect(rubberBand(0, PHONE)).toBe(0)
    expect(rubberBand(50, 0)).toBe(0)
  })
})

describe('pageDragOffset', () => {
  it('follows the finger exactly between pages', () => {
    expect(pageDragOffset({ dx: -120, index: 1, count: 3, width: PHONE })).toBe(-120)
    expect(pageDragOffset({ dx: 90, index: 1, count: 3, width: PHONE })).toBe(90)
  })

  it('turns at most one page per gesture', () => {
    expect(pageDragOffset({ dx: -900, index: 1, count: 5, width: PHONE })).toBe(-PHONE)
  })

  it('rubber-bands off either end instead of stopping dead', () => {
    const first = pageDragOffset({ dx: 120, index: 0, count: 3, width: PHONE })
    const last = pageDragOffset({ dx: -120, index: 2, count: 3, width: PHONE })
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(120)
    expect(last).toBeLessThan(0)
    expect(last).toBeGreaterThan(-120)
  })

  it('still moves freely away from an end', () => {
    expect(pageDragOffset({ dx: -120, index: 0, count: 3, width: PHONE })).toBe(-120)
  })
})

describe('settlePage', () => {
  const at = (dx: number, speed: number, index = 1, count = 3) =>
    settlePage({ index, count, dx, speed, width: PHONE })

  it('stays put for a slow, short drag', () => {
    expect(at(-60, -0.05)).toBe(1)
    expect(at(60, 0.05)).toBe(1)
  })

  it('turns for a slow drag past halfway', () => {
    expect(at(-200, 0)).toBe(2)
    expect(at(200, 0)).toBe(0)
  })

  // The case distance-only judging got wrong: an unmistakable flick did nothing.
  it('turns on a short quick flick', () => {
    expect(at(-40, -0.8)).toBe(2)
    expect(at(40, 0.8)).toBe(0)
  })

  it('does not turn on a nudge at an ordinary drag speed', () => {
    expect(at(-13, -0.3)).toBe(1)
  })

  // A wobble as the finger lifts must not undo a drag that was most of the way.
  it('survives a wobble back past the turn', () => {
    expect(at(-220, FLICK_BACK / 2)).toBe(2)
  })

  it('lets a deliberate throw back win', () => {
    expect(at(-200, 1.2)).toBe(1)
  })

  it('never leaves the track', () => {
    expect(at(-300, -2, 2, 3)).toBe(2)
    expect(at(300, 2, 0, 3)).toBe(0)
    expect(settlePage({ index: 0, count: 1, dx: -300, speed: -2, width: PHONE })).toBe(0)
  })

  it('caps the turn on a wide screen, so an iPad does not need half its width', () => {
    expect(settlePage({ index: 1, count: 3, dx: -(PAGE_TURN_PX + 10), speed: 0, width: 1024 })).toBe(2)
  })
})

describe('settleDurationMs', () => {
  it('takes the full settle from a still release', () => {
    expect(settleDurationMs(300, 0)).toBe(SETTLE_MS)
    expect(settleDurationMs(0, 2)).toBe(SETTLE_MS)
  })

  it('lands a hard flick faster, but never in a blink', () => {
    const quick = settleDurationMs(300, 4)
    expect(quick).toBeLessThan(SETTLE_MS)
    expect(settleDurationMs(300, 50)).toBe(SETTLE_MIN_MS)
  })

  it('is never slower than the plain settle', () => {
    expect(settleDurationMs(300, 0.3)).toBe(SETTLE_MS)
  })
})
