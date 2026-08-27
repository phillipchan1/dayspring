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

/**
 * Furthest back: the pages as rows.
 *
 * D-018 deleted the entries list on the reasoning that the wall beats a 30px
 * row at every job the row does. That was wrong in one narrow, real way —
 * browsing for a half-remembered entry got slower, because a row shows ~30 a
 * screen and the wall at its densest shows fewer. D-018's own kill note said
 * what to do about it: "an argument for a LIST-TIGHT END OF THE ZOOM rather
 * than for a second surface."
 *
 * So the list is not a surface and not a mode. It is standing very far back —
 * same wall, same `look for`, same lighting, same windowing, at 30 rows a
 * screen. 25px + 3px of gap puts 32 on a 900px viewport.
 */
const ROWS = { minWidth: 320, cardHeight: 25, gap: 3, maxCols: 1, lines: 1 }

/** Far end: many pages at once. You read shape, dates, and where your marks fall. */
const FAR = { minWidth: 150, cardHeight: 190, gap: 12, maxCols: 8, lines: 6 }
/**
 * Near end: two pages side by side, read rather than glanced at.
 *
 * Not "one step short of reading" — this IS the reading view. The wall and the
 * open book were two separate things at first, and they were never two things:
 * you are standing further away, or you are standing close enough to read. So
 * the top of the range renders whole pages, two up, and you scroll through them.
 */
const NEAR = { minWidth: 460, cardHeight: 620, gap: 28, maxCols: 2, lines: 18 }

/**
 * Where a card stops being a card and becomes a page you can read.
 *
 * A threshold rather than a smooth blend because the two renderings are
 * genuinely different — an excerpt of flattened lines versus the writer's
 * markdown with their highlights and blockquotes intact. Crossfading those
 * would be mush.
 */
export const READING_ZOOM = 0.82

export const isReading = (zoom: number): boolean => clampZoom(zoom) >= READING_ZOOM

/**
 * Where a card stops being a card and becomes a row.
 *
 * A threshold for the same reason `READING_ZOOM` is one: an excerpt in a box
 * and a single line with a date are genuinely different renderings, and
 * interpolating between them gives you a squashed card rather than a list.
 */
export const ROWS_ZOOM = 0.16

export const isRows = (zoom: number): boolean => clampZoom(zoom) < ROWS_ZOOM

/** What the slider is doing, for the label beside it. */
export function standLabel(zoom: number): string {
  if (isRows(zoom)) return 'a list'
  if (isReading(zoom)) return 'reading'
  return clampZoom(zoom) < 0.55 ? 'the years' : 'the pages'
}

/**
 * How many pages are open at reading zoom.
 *
 * A hard two, not the interpolated `maxCols` — that lands on three at the
 * threshold and only reaches two at the very end of the range, so "close enough
 * to read" would mean three pages at first and two later, which is not a thing
 * an open book does. One on a phone, which cannot hold two.
 */
export const readingCols = (single: boolean): number => (single ? 1 : 2)

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
  const z = clampZoom(zoom)
  if (isRows(z)) return { ...ROWS }
  // The card bands own what is left of the slider, renormalised — otherwise
  // adding a band at the bottom would silently shift every card size above it.
  const t = (z - ROWS_ZOOM) / (ZOOM_MAX - ROWS_ZOOM)
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
