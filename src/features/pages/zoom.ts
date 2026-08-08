// How close you're standing to the wall.
//
// This replaced three buttons labelled Wall / Shelf / Open. They were never
// three things — they were three samples of one continuous act, and naming the
// samples made you pick a mode instead of just moving closer. There is one
// number now, and everything on screen is a function of it.
//
// One source of truth for the geometry: the windowing math and the CSS both read
// these numbers, so a card can never be a different height than the scroller
// thinks it is.

/** Far end: many pages at once. You read shape, dates, and where your marks fall. */
const FAR = { minWidth: 150, cardHeight: 190, gap: 12, maxCols: 8, lines: 6 }
/** Near end: few pages, nearly readable. One step short of the Spread. */
const NEAR = { minWidth: 340, cardHeight: 404, gap: 20, maxCols: 3, lines: 18 }

/**
 * The most lines any card can want.
 *
 * Excerpts are built once at this budget and sliced per card, because the
 * budget changes on every frame of a pinch and rebuilding 3,500 excerpts at
 * 60fps is the one thing that would make this surface feel slow.
 */
export const EXCERPT_MAX_LINES = NEAR.lines

export interface ZoomSpec {
  /** Narrowest a page may get before dropping a column. */
  minWidth: number
  cardHeight: number
  gap: number
  /** Never more than this many columns, however wide the screen. */
  maxCols: number
  /** Excerpt lines this size can hold. A budget, not a promise. */
  lines: number
}

/** Where a fresh install stands, and where ⌘0 returns you to. */
export const PAGES_ZOOM_DEFAULT = 0.45
export const ZOOM_MIN = 0
export const ZOOM_MAX = 1
/** One press of ⌘= / ⌘−, and one notch of the slider. */
export const ZOOM_STEP = 0.08

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return PAGES_ZOOM_DEFAULT
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t)

/**
 * Geometry for a zoom level.
 *
 * Every field is rounded to an integer. The row height derived from
 * `cardHeight + gap` is what the windowing math divides scrollTop by, and a
 * fractional row height accumulates error down a 3,500-page wall until the
 * rendered window and the scroll position disagree by a whole row.
 */
export function specForZoom(zoom: number): ZoomSpec {
  const t = clampZoom(zoom)
  return {
    minWidth: lerp(FAR.minWidth, NEAR.minWidth, t),
    cardHeight: lerp(FAR.cardHeight, NEAR.cardHeight, t),
    gap: lerp(FAR.gap, NEAR.gap, t),
    maxCols: lerp(FAR.maxCols, NEAR.maxCols, t),
    lines: lerp(FAR.lines, NEAR.lines, t),
  }
}

/**
 * A pinch or ⌘-scroll, as a zoom delta.
 *
 * Trackpad pinch arrives as a wheel event with `ctrlKey` set — the same shape a
 * deliberate ⌘/Ctrl-scroll has — so one handler serves both. `deltaY` is
 * unbounded and its units differ per device and per `deltaMode`, so it is
 * damped and clamped rather than trusted.
 */
export function wheelZoomDelta(deltaY: number, deltaMode = 0): number {
  // deltaMode 1 is lines, 2 is pages; normalize both to something pixel-ish.
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  return Math.max(-0.1, Math.min(0.1, -px / 900))
}
