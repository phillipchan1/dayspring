import { describe, expect, it } from 'vitest'
import {
  clampPan,
  doubleTapZoom,
  DOUBLE_TAP_SCALE,
  FIT,
  isDoubleTap,
  isZoomed,
  MAX_ZOOM,
  panLimits,
  pinchScale,
  pullProgress,
  pullScale,
  settleZoom,
  zoomAbout,
} from './viewerGesture'

const STAGE = { w: 400, h: 800 }
/** A landscape photo fitted to that stage. */
const PHOTO = { w: 400, h: 300 }

describe('zoomAbout', () => {
  it('keeps the point under the fingers where it was', () => {
    const anchor = { x: 100, y: -50 }
    const z = zoomAbout(FIT, 2, anchor)
    // The photo point that was under the anchor at 1× is (100, -50); at 2×
    // with the new translation it must land back on the anchor.
    expect(z.x + 100 * z.s).toBe(anchor.x)
    expect(z.y + -50 * z.s).toBe(anchor.y)
  })

  it('is the identity about the centre at the same scale', () => {
    expect(zoomAbout(FIT, 1, { x: 0, y: 0 })).toEqual(FIT)
  })
})

describe('pinchScale', () => {
  it('is free between fit and the most', () => {
    expect(pinchScale(1)).toBe(1)
    expect(pinchScale(2.5)).toBe(2.5)
  })

  it('resists below fit and beyond the most, rather than stopping dead', () => {
    expect(pinchScale(0.5)).toBeGreaterThan(0.5)
    expect(pinchScale(0.5)).toBeLessThan(1)
    expect(pinchScale(8)).toBeGreaterThan(MAX_ZOOM)
    expect(pinchScale(8)).toBeLessThan(8)
  })
})

describe('pan limits', () => {
  it('lets a fitted photo go nowhere', () => {
    expect(panLimits(PHOTO, STAGE, 1)).toEqual({ x: 0, y: 0 })
  })

  it('opens up only the axis the zoomed photo overflows', () => {
    // 2×: 800 × 600 in a 400 × 800 stage — 200 each way sideways, none up/down.
    expect(panLimits(PHOTO, STAGE, 2)).toEqual({ x: 200, y: 0 })
  })

  it('stops at the edge on release and rubber-bands past it under a finger', () => {
    const past = { s: 2, x: 300, y: 0 }
    expect(clampPan(past, PHOTO, STAGE, null).x).toBe(200)
    const held = clampPan(past, PHOTO, STAGE, STAGE).x
    expect(held).toBeGreaterThan(200)
    expect(held).toBeLessThan(300)
  })
})

describe('settleZoom', () => {
  it('springs a squeezed photo back to fit', () => {
    expect(settleZoom({ s: 0.8, x: 30, y: 10 }, PHOTO, STAGE)).toEqual(FIT)
  })

  it('brings an over-pinch back to the most', () => {
    expect(settleZoom({ s: 5, x: 0, y: 0 }, PHOTO, STAGE).s).toBe(MAX_ZOOM)
  })

  it('pulls a pan back inside the photo', () => {
    expect(settleZoom({ s: 2, x: 500, y: 90 }, PHOTO, STAGE)).toEqual({ s: 2, x: 200, y: 0 })
  })
})

describe('doubleTapZoom', () => {
  it('goes in to 2× about the tap', () => {
    const z = doubleTapZoom(FIT, { x: 50, y: 0 }, PHOTO, STAGE)
    expect(z.s).toBe(DOUBLE_TAP_SCALE)
    expect(z.x).toBe(-50)
  })

  it('stays inside the photo when the tap is near its edge', () => {
    expect(doubleTapZoom(FIT, { x: 190, y: 0 }, PHOTO, STAGE).x).toBe(-190)
    expect(Math.abs(doubleTapZoom(FIT, { x: 500, y: 0 }, PHOTO, STAGE).x)).toBeLessThanOrEqual(200)
  })

  it('comes back out to fit from any zoom', () => {
    expect(doubleTapZoom({ s: 3, x: 40, y: 0 }, { x: 0, y: 0 }, PHOTO, STAGE)).toEqual(FIT)
    expect(isZoomed(FIT)).toBe(false)
  })
})

describe('the pull down', () => {
  it('has gone nowhere upward or at rest', () => {
    expect(pullProgress(0, 800)).toBe(0)
    expect(pullProgress(-40, 800)).toBe(0)
  })

  it('shrinks the photo as it goes, but not to nothing', () => {
    const half = pullProgress(240, 800)
    expect(half).toBeCloseTo(0.5)
    expect(pullScale(half)).toBeLessThan(1)
    expect(pullScale(pullProgress(5000, 800))).toBeGreaterThan(0.6)
  })
})

describe('isDoubleTap', () => {
  it('needs two taps close in time and place', () => {
    const first = { t: 0, x: 100, y: 100 }
    expect(isDoubleTap(null, first)).toBe(false)
    expect(isDoubleTap(first, { t: 200, x: 110, y: 104 })).toBe(true)
    expect(isDoubleTap(first, { t: 400, x: 100, y: 100 })).toBe(false)
    expect(isDoubleTap(first, { t: 200, x: 200, y: 100 })).toBe(false)
  })
})
