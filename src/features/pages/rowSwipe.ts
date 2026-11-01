import { PROJECTION_MS } from '@/hooks/useSwipeToDismiss'

/**
 * Trailing swipe actions on a narrow row — the decisions, kept pure.
 *
 * A row dragged left shows its verbs behind it (Change date…, Delete…), the
 * way every list on iOS does. Let go past half the tray and it stays open;
 * short of that it closes; drag it most of the way across and the trailing,
 * primary verb fires — here, Delete…, which opens the same confirmation the
 * long-press menu does. Nothing is ever deleted by a swipe alone.
 *
 * The axis, the long-press guard and the velocity smoothing are the reader's
 * back-swipe's (`useSwipeToDismiss`), reused rather than re-tuned: a row
 * swipe that disagreed with the page swipe about what "sideways" means would
 * be the first thing a thumb noticed.
 */

/** One action's width when the tray is open, in px — about UIKit's. */
export const ACTION_W = 84
/** The verbs a row offers, trailing (primary) last. */
export const ROW_ACTIONS = ['edit-date', 'delete'] as const
export type RowAction = (typeof ROW_ACTIONS)[number]
/** The tray's width when it rests open. */
export const TRAY_W = ACTION_W * ROW_ACTIONS.length
/** How much of the row a drag must cross before the primary verb fires. */
export const FULL_RATIO = 0.6

/**
 * Where the row is drawn for a drag: its resting place (`base` — 0, or
 * `-TRAY_W` when it was already open) plus the travel, never right of home and
 * never further left than its own width.
 */
export function rowOffset(base: number, dx: number, width: number): number {
  return Math.max(-width, Math.min(0, base + dx))
}

/**
 * How far left the row must be dragged for the primary verb to fire.
 *
 * A fraction of the row, but never less than the open tray plus a thumb's
 * width: on a narrow row 60% would sit inside the tray, and then simply
 * opening it would delete.
 */
export function fullAt(width: number, tray = TRAY_W): number {
  return Math.max(tray + 48, width * FULL_RATIO)
}

export type RowSwipeOutcome = 'closed' | 'open' | 'full'

/**
 * What a release does.
 *
 * Opening is judged on where the finger was HEADED (projected, as the back
 * swipe is), so a quick flick opens the tray without dragging it all the way.
 * The primary verb is judged on where the row actually IS — never projected —
 * because a flick should not be able to ask to delete a page.
 */
export function rowSwipeOutcome({
  offset,
  speed,
  width,
  tray = TRAY_W,
}: {
  /** The row's drawn offset at release (≤ 0). */
  offset: number
  /** px/ms at release, signed: negative is leftward. */
  speed: number
  width: number
  tray?: number
}): RowSwipeOutcome {
  if (-offset >= fullAt(width, tray)) return 'full'
  const projected = offset + speed * PROJECTION_MS
  return -projected > tray / 2 ? 'open' : 'closed'
}
