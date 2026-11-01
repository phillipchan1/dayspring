import { useEffect, useRef, useState } from 'react'
import {
  axisOf,
  commits,
  isSwipeNotPress,
  locksToScroll,
  speedAtRelease,
} from './useSwipeToDismiss'

/**
 * A finger-tracked paged track — the Welcome slides, the What's new deck — and,
 * optionally, a pull down to dismiss the whole thing.
 *
 * `useSwipeToDismiss` is the model, and most of its rules are reused here as-is:
 * the axis has to be MEANT (`axisOf`), a press that turns into a drag is somebody
 * moving a caret (`isSwipeNotPress`), a resting finger has no speed
 * (`speedAtRelease`), and the gesture is followed on the window with a
 * non-passive listener so it can `preventDefault` once it is ours. What it adds
 * is what a paged scroll view does that a dismissal doesn't:
 *
 *  - **The track follows the finger.** It used to be judged once, on release,
 *    by distance alone — so nothing moved until the finger lifted and then the
 *    whole slide jumped. Now `offsetX` is live, and the page under the finger
 *    is the page that moves.
 *  - **The ends give, but only a little.** Past the first or last page the
 *    track rubber-bands (`rubberBand`, UIScrollView's own curve) instead of
 *    stopping dead or showing nothing.
 *  - **Release is judged by where the finger was headed** (`settlePage`), and
 *    the settle is timed by how fast it was going (`settleDurationMs`), so a
 *    flick lands quickly and a slow drag is placed gently.
 *
 * The consumer draws `translateX(calc(-index * 100% + offsetX px))` with the
 * transition switched off while `dragging === 'h'`, and on otherwise as
 * `transform settleMs var(--ease-spring)`.
 */

/**
 * How far ahead a paging release is projected, in ms of continued travel.
 *
 * Longer than a dismissal's 100ms on purpose. Turning a page is cheap and
 * reversible, and a paged scroll view turns on a short quick flick — a 40px
 * flick at an ordinary 0.8px/ms has to reach the turn on a phone.
 */
export const PAGE_PROJECTION_MS = 200

/**
 * The most a page has to travel before release turns it.
 *
 * Half the width on a phone, which is UIScrollView's rule. On an iPad half the
 * width is 500px of thumb travel, so it is capped: past this, the page goes.
 */
export const PAGE_TURN_PX = 180

/**
 * A finger moving back towards home at least this fast (px/ms) has changed its
 * mind, even past the turn.
 *
 * Below it is a wobble as the finger lifts, and a wobble must not undo a drag
 * that was most of the way there — the same lesson as `POINT_OF_NO_RETURN`.
 */
export const FLICK_BACK = 0.4

/** UIScrollView's rubber-band constant. */
export const RUBBER_BAND = 0.55

/** The settle when nothing says otherwise — the sheet duration, `--dur-sheet`. */
export const SETTLE_MS = 380

/** A hard flick lands fast, but never in a blink. */
export const SETTLE_MIN_MS = 220

/**
 * How steep `--ease-spring` sets off: progress per unit of its duration over the
 * first few percent (0.23 at 5%, 0.5 at 9%). It is what turns "the finger was
 * going this fast" into "the spring should take this long".
 */
const SPRING_LAUNCH = 4.5

const SPEED_SMOOTHING = 0.6

/**
 * How far a drag of `offset` px is drawn, against a limit of `dimension` px.
 *
 * UIScrollView's curve: it gives readily at first and ever less after, and it
 * never reaches the dimension however far the finger goes.
 */
export function rubberBand(offset: number, dimension: number, coefficient = RUBBER_BAND): number {
  if (dimension <= 0 || offset === 0) return 0
  const x = Math.abs(offset)
  return Math.sign(offset) * (1 - 1 / ((x * coefficient) / dimension + 1)) * dimension
}

/**
 * The drawn offset of a page being dragged `dx` px.
 *
 * Between pages it is the finger, up to one page either way (a paged track
 * turns one page per gesture). Off either end it is rubber-banded.
 */
export function pageDragOffset({
  dx,
  index,
  count,
  width,
}: {
  dx: number
  index: number
  count: number
  width: number
}): number {
  if (width <= 0) return 0
  if ((index <= 0 && dx > 0) || (index >= count - 1 && dx < 0)) return rubberBand(dx, width)
  return Math.max(-width, Math.min(width, dx))
}

/**
 * The page a release lands on.
 *
 * Past the turn, the page goes unless the finger was thrown back
 * (`FLICK_BACK`). Short of it, the release is projected (`PAGE_PROJECTION_MS`)
 * so a fast flick needs less distance in exact proportion to its speed — and a
 * flick may go either way, as it does in a paged scroll view. One page at most,
 * and never off either end.
 */
export function settlePage({
  index,
  count,
  dx,
  speed,
  width,
}: {
  index: number
  count: number
  /** Signed travel since the drag was recognised. */
  dx: number
  /** px/ms at release, signed the same way. */
  speed: number
  width: number
}): number {
  if (count <= 1 || width <= 0) return index
  const reach = Math.min(width / 2, PAGE_TURN_PX)
  let next = index
  const thrownBack = speed * Math.sign(dx) < -FLICK_BACK
  if (Math.abs(dx) >= reach && !thrownBack) {
    next = index + (dx < 0 ? 1 : -1)
  } else {
    const projected = dx + speed * PAGE_PROJECTION_MS
    if (projected <= -reach) next = index + 1
    else if (projected >= reach) next = index - 1
  }
  return Math.max(0, Math.min(count - 1, next))
}

/**
 * How long the settle should take, so the spring sets off about as fast as the
 * finger was going.
 *
 * `speed` is towards the destination (0 if the finger was going the other way
 * or had stopped). A still release takes `SETTLE_MS`; a fast one takes less, so
 * the page does not visibly brake the instant the finger lets go of it.
 */
export function settleDurationMs(distance: number, speed: number): number {
  if (!(speed > 0.05) || !(distance > 1)) return SETTLE_MS
  return Math.round(Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MS, (SPRING_LAUNCH * distance) / speed)))
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** What a gesture has turned out to be. */
type Axis = 'h' | 'down' | 'v' | null

export function usePagedSwipe({
  index,
  count,
  onIndex,
  enabled = true,
  pullDown,
}: {
  index: number
  count: number
  onIndex: (next: number) => void
  enabled?: boolean
  /**
   * Pull the whole surface down to dismiss it. A gesture that starts inside a
   * `[data-sheet-scroll]` region already scrolled away from its top belongs to
   * that region — the useSheetDismiss rule, for the same reason.
   */
  pullDown?: {
    onDismiss: () => void
    /** Downward distance (px, after projection) past which release dismisses. */
    threshold?: number
    /**
     * How long the surface takes to finish leaving once committed; pair with a
     * CSS rule on the `leaving` state lasting as long. 0 dismisses at once.
     */
    exitMs?: number
  }
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<Axis>(null)
  const landed = useRef(0)
  const span = useRef({ w: 0, h: 0 })
  const blockedDown = useRef(false)
  const live = useRef({ dx: 0, dy: 0 })
  const speed = useRef(0)
  const last = useRef<{ v: number; t: number } | null>(null)
  const bound = useRef<(() => void) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The props the window listeners need, read fresh rather than closed over.
  const props = useRef({ index, count, onIndex, pullDown })
  props.current = { index, count, onIndex, pullDown }

  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [dragging, setDragging] = useState<'h' | 'down' | null>(null)
  const [settleMs, setSettleMs] = useState(SETTLE_MS)
  const [leaving, setLeaving] = useState(false)

  useEffect(
    () => () => {
      bound.current?.()
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function clear() {
    bound.current?.()
    start.current = null
    axis.current = null
    last.current = null
    live.current = { dx: 0, dy: 0 }
    speed.current = 0
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (!t || leaving || e.touches.length > 1) return
    const now = performance.now()
    start.current = { x: t.clientX, y: t.clientY }
    landed.current = now
    axis.current = null
    speed.current = 0
    last.current = null
    const box = e.currentTarget.getBoundingClientRect()
    span.current = { w: box.width, h: box.height }
    const scroller = (e.target as Element | null)?.closest?.('[data-sheet-scroll]')
    blockedDown.current = !props.current.pullDown || (scroller != null && scroller.scrollTop > 0)
    follow()
  }

  function follow() {
    bound.current?.()
    const move = (ev: TouchEvent) => {
      if (ev.touches.length > 1) return
      const t = ev.touches[0]
      if (t) track(t)
      if ((axis.current === 'h' || axis.current === 'down') && ev.cancelable) ev.preventDefault()
    }
    const end = () => release()
    const cancel = () => {
      clear()
      setOffsetX(0)
      setOffsetY(0)
      setSettleMs(SETTLE_MS)
      setDragging(null)
    }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', cancel)
    bound.current = () => {
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', cancel)
      bound.current = null
    }
  }

  function track(t: Touch) {
    const s = start.current
    if (!s) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (axis.current !== 'h' && axis.current !== 'down') {
      // Scrolling for real now; it stays a scroll.
      if (axis.current === 'v' && locksToScroll(dy)) return
      const next = axisOf(dx, dy)
      if (next === null) return
      const at = performance.now()
      const swipe = isSwipeNotPress(at - landed.current)
      if (next === 'h' && swipe) {
        axis.current = 'h'
        // Measure from here, not touchdown — see useSwipeToDismiss.
        start.current = { x: t.clientX, y: t.clientY }
        last.current = { v: t.clientX, t: at }
        setDragging('h')
        return
      }
      if (next === 'v' && dy > 0 && swipe && !blockedDown.current) {
        axis.current = 'down'
        start.current = { x: t.clientX, y: t.clientY }
        last.current = { v: t.clientY, t: at }
        setDragging('down')
        return
      }
      axis.current = 'v'
      return
    }
    const along = axis.current === 'h' ? t.clientX : t.clientY
    const prev = last.current
    const now = performance.now()
    if (prev) {
      const dt = now - prev.t
      if (dt > 0) {
        const sample = (along - prev.v) / dt
        speed.current = speed.current * (1 - SPEED_SMOOTHING) + sample * SPEED_SMOOTHING
        last.current = { v: along, t: now }
      }
    }
    if (axis.current === 'h') {
      live.current.dx = dx
      const { index: at, count: n } = props.current
      setOffsetX(pageDragOffset({ dx, index: at, count: n, width: span.current.w }))
    } else {
      live.current.dy = dy
      // Above home there is nowhere to go; a sheet stops at its top.
      setOffsetY(dy > 0 ? dy : rubberBand(dy, span.current.h) * 0.25)
    }
  }

  function release() {
    bound.current?.()
    const kind = axis.current
    const idle = last.current ? performance.now() - last.current.t : Infinity
    const v = speedAtRelease(speed.current, idle)
    const { dx, dy } = live.current
    const { index: at, count: n, onIndex: turn, pullDown: pd } = props.current
    clear()

    if (kind === 'h') {
      const w = span.current.w
      const target = settlePage({ index: at, count: n, dx, speed: v, width: w })
      const drawn = pageDragOffset({ dx, index: at, count: n, width: w })
      const goal = target === at ? 0 : target > at ? -w : w
      const toward = Math.sign(goal - drawn) * v
      setSettleMs(settleDurationMs(Math.abs(goal - drawn), Math.max(0, toward)))
      setOffsetX(0)
      setDragging(null)
      if (target !== at) turn(target)
      return
    }

    if (kind === 'down' && pd) {
      const go = commits({ dx: dy, speed: v, threshold: pd.threshold ?? 110, width: span.current.h })
      setDragging(null)
      if (!go) {
        setSettleMs(settleDurationMs(Math.max(0, dy), Math.max(0, -v)))
        setOffsetY(0)
        return
      }
      const exit = pd.exitMs ?? 0
      if (exit <= 0 || reducedMotion()) {
        pd.onDismiss()
        return
      }
      // Keep `offsetY` where the finger left it: the surface carries on from
      // there under CSS, rather than snapping home for a frame first.
      setLeaving(true)
      timer.current = setTimeout(() => {
        timer.current = null
        setLeaving(false)
        setOffsetY(0)
        pd.onDismiss()
      }, exit)
      return
    }

    setDragging(null)
  }

  if (!enabled) {
    return { handlers: {}, offsetX: 0, offsetY: 0, dragging: null, settleMs: SETTLE_MS, leaving: false }
  }
  return { handlers: { onTouchStart }, offsetX, offsetY, dragging, settleMs, leaving }
}
