// The photo viewer's zoom, pan and pull, as plain arithmetic.
//
// The page's viewport is pinned (`user-scalable=no` in index.html, so the shell
// never pinch-zooms), which also means the browser will never zoom a photo for
// us. So the viewer does it itself, with pointers and a transform on the photo's
// frame: `translate(x, y) scale(s)`, about the frame's centre, which is the
// stage's centre. Every point here is measured from that centre.

import { rubberBand } from '@/hooks/usePagedSwipe'

export interface Zoom {
  /** Scale; 1 is the photo fitted to the stage. */
  s: number
  x: number
  y: number
}

export const FIT: Zoom = { s: 1, x: 0, y: 0 }

/** Where a double tap goes in from fit: 2×, as Photos does. */
export const DOUBLE_TAP_SCALE = 2

/** The furthest in a pinch may settle. */
export const MAX_ZOOM = 4

export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

/** Zoomed in at all, as opposed to fitted with a rounding error. */
export function isZoomed(z: Zoom): boolean {
  return z.s > 1.01
}

/**
 * The scale a pinch draws while the fingers are down: free between fit and
 * `MAX_ZOOM`, and resisting past either, so the photo can be squeezed a little
 * smaller than fit — and springs back — the way a photo does in Photos.
 */
export function pinchScale(raw: number): number {
  if (raw < 1) return 1 - rubberBand(1 - raw, 1) * 0.8
  if (raw > MAX_ZOOM) return MAX_ZOOM + rubberBand(raw - MAX_ZOOM, MAX_ZOOM)
  return raw
}

/**
 * Scale from `from` to `s` about `anchor`, so the point of the photo under the
 * anchor (the pinch's midpoint, the tap, the pointer) stays under it.
 */
export function zoomAbout(from: Zoom, s: number, anchor: Point): Zoom {
  const k = s / from.s
  return { s, x: anchor.x - (anchor.x - from.x) * k, y: anchor.y - (anchor.y - from.y) * k }
}

/** How far the photo may travel each way at scale `s` before showing ground. */
export function panLimits(photo: Size, stage: Size, s: number): Point {
  return {
    x: Math.max(0, (photo.w * s - stage.w) / 2),
    y: Math.max(0, (photo.h * s - stage.h) / 2),
  }
}

function clampAxis(v: number, limit: number, give: number): number {
  if (v > limit) return give > 0 ? limit + rubberBand(v - limit, give) : limit
  if (v < -limit) return give > 0 ? -limit + rubberBand(v + limit, give) : -limit
  return v
}

/**
 * Keep a pan inside the photo. While a finger is on it (`give` = the stage
 * size), past the edge it rubber-bands; let go (`give` = 0), it stops at the
 * edge.
 */
export function clampPan(z: Zoom, photo: Size, stage: Size, give: Size | null): Zoom {
  const lim = panLimits(photo, stage, z.s)
  return {
    s: z.s,
    x: clampAxis(z.x, lim.x, give?.w ?? 0),
    y: clampAxis(z.y, lim.y, give?.h ?? 0),
  }
}

/** Where a zoom comes to rest once nothing is holding it. */
export function settleZoom(z: Zoom, photo: Size, stage: Size, anchor: Point = { x: 0, y: 0 }): Zoom {
  if (z.s <= 1) return FIT
  const s = Math.min(z.s, MAX_ZOOM)
  return clampPan(s === z.s ? z : zoomAbout(z, s, anchor), photo, stage, null)
}

/** A double tap: in to 2× about the tap, or, if already in, back out to fit. */
export function doubleTapZoom(z: Zoom, at: Point, photo: Size, stage: Size): Zoom {
  if (isZoomed(z)) return FIT
  return clampPan(zoomAbout(FIT, DOUBLE_TAP_SCALE, at), photo, stage, null)
}

/**
 * How far a pull down has gone, 0–1: the photo shrinks with it and the ground
 * fades, so what is under the viewer shows through before it lets go.
 */
export function pullProgress(dy: number, stageHeight: number): number {
  if (dy <= 0 || stageHeight <= 0) return 0
  return Math.min(1, dy / (stageHeight * 0.6))
}

/** The photo's scale at a given pull: never smaller than about two thirds. */
export function pullScale(progress: number): number {
  return 1 - 0.35 * progress
}

/** Is this pair of taps a double tap? Close in time and in place. */
export function isDoubleTap(
  prev: { t: number; x: number; y: number } | null,
  next: { t: number; x: number; y: number },
): boolean {
  if (!prev) return false
  return next.t - prev.t < 300 && Math.hypot(next.x - prev.x, next.y - prev.y) < 30
}
