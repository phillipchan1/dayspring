// Turning the page with a thumb.
//
// The reader is a SCROLLER first and a page-turner second, and that ordering is
// the whole of this module. A journal page is something you came here to read;
// turning it by accident halfway down loses your place in the one thing on
// screen. So an ambiguous gesture always loses to scrolling, and the cost of
// that — the occasional lazy swipe that does nothing — is the cheap failure.

/** How far a thumb must travel before the gesture is a turn at all. */
export const SWIPE_MIN_PX = 64

/**
 * How much more horizontal than vertical it has to be.
 *
 * A diagonal flick is nearly always a scroll that wandered, not a turn that
 * drifted — thumbs arc. Requiring the horizontal leg to beat the vertical one
 * by half again is what keeps a fast scroll up a long page from turning it.
 */
export const SWIPE_DOMINANCE = 1.6

/**
 * Which way a completed swipe turns, if it turns at all.
 *
 * Direction follows the WALL, not a calendar. The wall runs newest-first, left
 * to right, so the page to the right of this one is the OLDER one — dragging
 * the content leftward (`dx < 0`) brings it on, the same way it does everywhere
 * else that has a next. Opening a page must not reverse the direction of the
 * archive you were just looking at.
 */
export function swipeTurn(dx: number, dy: number): 'newer' | 'older' | null {
  if (Math.abs(dx) < SWIPE_MIN_PX) return null
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return null
  return dx < 0 ? 'older' : 'newer'
}
