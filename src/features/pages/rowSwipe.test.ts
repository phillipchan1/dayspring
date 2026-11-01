import { describe, expect, it } from 'vitest'
import { FULL_RATIO, TRAY_W, fullAt, rowOffset, rowSwipeOutcome } from './rowSwipe'

const W = 360

describe('rowOffset', () => {
  it('follows the finger leftward from rest', () => {
    expect(rowOffset(0, -50, W)).toBe(-50)
  })

  it('never goes right of home — there is nothing on the leading side', () => {
    expect(rowOffset(0, 40, W)).toBe(0)
    expect(rowOffset(-TRAY_W, TRAY_W + 30, W)).toBe(0)
  })

  it('carries on from an open tray', () => {
    expect(rowOffset(-TRAY_W, -20, W)).toBe(-TRAY_W - 20)
    expect(rowOffset(-TRAY_W, 60, W)).toBe(-TRAY_W + 60)
  })

  it('stops at its own width', () => {
    expect(rowOffset(0, -900, W)).toBe(-W)
  })
})

describe('fullAt', () => {
  it('is most of a wide row', () => {
    expect(fullAt(600)).toBe(600 * FULL_RATIO)
  })

  it('is never inside the open tray, so opening it can never fire the verb', () => {
    expect(fullAt(200)).toBeGreaterThan(TRAY_W)
  })
})

describe('rowSwipeOutcome', () => {
  it('closes a short, slow drag', () => {
    expect(rowSwipeOutcome({ offset: -30, speed: 0, width: W })).toBe('closed')
  })

  it('opens past half the tray', () => {
    expect(rowSwipeOutcome({ offset: -(TRAY_W / 2 + 5), speed: 0, width: W })).toBe('open')
  })

  it('opens on a quick leftward flick that has not travelled far', () => {
    expect(rowSwipeOutcome({ offset: -40, speed: -0.8, width: W })).toBe('open')
  })

  it('closes an open tray flicked back rightward', () => {
    expect(rowSwipeOutcome({ offset: -TRAY_W + 40, speed: 1.2, width: W })).toBe('closed')
  })

  it('fires the primary verb only from where the row actually is', () => {
    expect(rowSwipeOutcome({ offset: -fullAt(W), speed: 0, width: W })).toBe('full')
    // A violent flick from just past the tray projects far beyond the line,
    // but asks for no deletion — it only opens.
    expect(rowSwipeOutcome({ offset: -TRAY_W - 10, speed: -3, width: W })).toBe('open')
  })
})
