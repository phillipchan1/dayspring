import { useRef, useState } from 'react'

/**
 * Drag-to-dismiss for a bottom sheet, grabbable anywhere on the sheet.
 *
 * The grabber alone is a ~36px target most thumbs never find, so the whole
 * surface is draggable — but the sheet's body scrolls, and a gesture can only
 * mean one thing. The rules, in the order they're decided:
 *
 *  1. Lock to an axis on the first 8px, so a horizontal flick across the tab
 *     strip and a plain tap never move the sheet.
 *  2. Only a downward pull counts. Dragging up would lift the sheet off the
 *     bottom edge, which it has no room for.
 *  3. A gesture starting inside a region marked `data-sheet-scroll` is that
 *     region's to keep *unless* it is already scrolled to the very top — the
 *     one position where a downward drag has no scrolling left to do. This is
 *     what stops the sheet sliding away when you meant to scroll back up.
 *
 * Pair `data-sheet-scroll` with `overscroll-behavior: contain` so the scroller
 * doesn't rubber-band underneath the drag.
 *
 * Returns handlers to spread on the sheet plus a live `dragY` (px ≥ 0) and a
 * `dragging` flag: apply `translateY(dragY)` with the transition suppressed
 * while dragging, so the sheet tracks the finger instead of jumping on release.
 */
export function useSheetDismiss({
  onDismiss,
  enabled = true,
  threshold = 110,
}: {
  onDismiss: () => void
  enabled?: boolean
  /** Downward distance (px) past which release dismisses. */
  threshold?: number
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const blocked = useRef(false)
  /*
   * The distance, as a ref as well as state.
   *
   * State is for drawing; this is for deciding. `touchend` fires whether or not
   * React has flushed the render from the last `touchmove` — and on a fast flick
   * the two land in the same frame — so reading the state here meant the quickest
   * gestures, the ones most likely to be a dismissal, measured themselves as
   * zero and did nothing.
   */
  const live = useRef(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  function reset() {
    start.current = null
    axis.current = null
    blocked.current = false
    live.current = 0
    setDragY(0)
    setDragging(false)
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    start.current = { x: t.clientX, y: t.clientY }
    axis.current = null
    // Decide ownership up front, from where the finger landed. Checking
    // scrollTop mid-gesture would read a value the scroller had already begun
    // changing, and the sheet would fight the scroll.
    const scroller = (e.target as Element | null)?.closest?.('[data-sheet-scroll]')
    blocked.current = scroller !== null && scroller !== undefined && scroller.scrollTop > 0
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current
    const t = e.touches[0]
    if (!s || !t || blocked.current) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (axis.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return // wait for intent
      axis.current = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h'
      // An upward pull is a scroll, not a dismissal — hand the gesture back.
      if (axis.current === 'v' && dy < 0) {
        blocked.current = true
        return
      }
      if (axis.current === 'v') setDragging(true)
    }
    if (axis.current !== 'v') return
    live.current = Math.max(0, dy)
    setDragY(live.current)
  }

  function onTouchEnd() {
    if (axis.current === 'v' && live.current > threshold) onDismiss()
    reset()
  }

  if (!enabled) return { handlers: {}, dragY: 0, dragging: false }
  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    dragY,
    dragging,
  }
}
