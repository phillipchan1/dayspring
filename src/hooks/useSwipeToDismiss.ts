import { useRef, useState } from 'react'

/**
 * Swipe-to-dismiss for the right-side slide-in panels (Altar strand, Lamp book).
 * The panel lives flush to the right edge and dismisses rightward, so we follow
 * a rightward drag with the finger and let go past a threshold. The gesture locks
 * to an axis on first move, so vertical scrolling inside the panel still works and
 * a plain tap (no movement) never dismisses.
 *
 * Returns touch handlers to spread on the panel plus a live `dragX` (px ≥ 0) and
 * `dragging` flag — apply them as an inline transform so the panel tracks the
 * finger, then snaps back (CSS transition) or slides out (parent unsets `open`).
 */
export function useSwipeToDismiss({
  onDismiss,
  enabled = true,
  threshold = 80,
  direction = 'right',
}: {
  onDismiss: () => void
  enabled?: boolean
  /** Horizontal distance (px) past which release dismisses. */
  threshold?: number
  /**
   * Which way the surface leaves.
   *
   * `right` is for a panel flush to the right edge — it can only go one way, so
   * a leftward pull is resisted. `either` is for something that covers the whole
   * screen and is being backed out of rather than pushed aside: "swipe back" is
   * rightward in iOS and leftward in plenty of Android apps, and a reader that
   * only answers to one of them reads as broken to whoever has the other habit.
   * With `either`, `dragX` is signed.
   */
  direction?: 'right' | 'either'
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  /*
   * The distance, as a ref as well as state.
   *
   * State is for drawing; this is for deciding. `touchend` fires whether or not
   * React has flushed the render from the last `touchmove` — and on a fast flick
   * the two land in the same frame — so reading the state here meant a quick
   * swipe measured itself as zero and did nothing.
   */
  const live = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  function reset() {
    start.current = null
    axis.current = null
    live.current = 0
    setDragX(0)
    setDragging(false)
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    start.current = { x: t.clientX, y: t.clientY }
    axis.current = null
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current
    const t = e.touches[0]
    if (!s || !t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (axis.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return // wait for intent
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axis.current === 'h') setDragging(true)
    }
    if (axis.current !== 'h') return
    // Track rightward freely; resist a leftward pull when the surface can only
    // leave one way (the panel can't open further).
    live.current = direction === 'either' ? dx : Math.max(0, dx > 0 ? dx : dx * 0.2)
    setDragX(live.current)
  }

  function onTouchEnd() {
    const far =
      direction === 'either' ? Math.abs(live.current) > threshold : live.current > threshold
    if (axis.current === 'h' && far) onDismiss()
    reset()
  }

  if (!enabled) return { handlers: {}, dragX: 0, dragging: false }
  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    dragX,
    dragging,
  }
}
