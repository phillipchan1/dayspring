import { useEffect, useRef, useState } from 'react'

/**
 * Swipe-to-dismiss for a surface that leaves to the right — the right-side
 * slide-in panels (Altar strand, Lamp book) and the page reader, which is
 * backed out of the way every pushed view on a phone is backed out of.
 *
 * The gesture locks to an axis on the first few pixels, so vertical scrolling
 * inside the panel still works and a plain tap never dismisses.
 *
 * Returns touch handlers to spread on the surface, a live `dragX` (px) and
 * `dragging` flag to follow the finger with, and `leaving` — see below.
 *
 * ── What made this feel wrong in the hand, and what each fix is for ─────────
 *
 * **1. It only measured distance.** A 60px flick fast enough to be unmistakable
 * did nothing, while a 90px crawl dismissed. Every native back-gesture judges
 * where the finger was HEADED, so this one tracks velocity and projects it.
 *
 * **2. It let go of the surface at the moment of dismissal.** `onDismiss` fired
 * and `reset()` put `dragX` back to 0 in the same tick, so the panel snapped
 * back to centre for a frame before the parent unmounted it. The dismissal you
 * just made played backwards, fast, and that single frame is most of what
 * "janky" was. A committed gesture now sets `leaving` and the surface carries
 * on off the screen under CSS; `onDismiss` fires when it has gone.
 *
 * **3. It claimed the horizontal axis on a tie.** `|dx| > |dy|` hands a 46°
 * drag to the panel, and a thumb travelling down a long page is never exactly
 * vertical. A drag has to be meaningfully more sideways than not before it
 * counts as a dismissal.
 *
 * Both of those decisions are `axisOf` and `commits` below — pure, and tested,
 * because the velocity path had been dead in exactly the way a rule buried in a
 * touch handler goes dead: silently, and only for the gestures nobody can
 * reproduce by hand.
 */
/** Below this much travel, a gesture has not said which way it is going. */
const INTENT = 8

/**
 * Which way a gesture is going, once it has travelled far enough to say.
 *
 * Sideways ENOUGH, not merely more sideways than not. `|dx| > |dy|` hands a 46°
 * drag to the dismissal, and a thumb running down a page of prose is never
 * exactly vertical — so the surface would fall over while somebody was reading
 * it. The bias is what makes a horizontal gesture something you have to mean.
 */
export function axisOf(dx: number, dy: number): 'h' | 'v' | null {
  if (Math.abs(dx) < INTENT && Math.abs(dy) < INTENT) return null
  return Math.abs(dx) > Math.abs(dy) * 1.4 ? 'h' : 'v'
}

/**
 * How far ahead a release is projected, in ms of continued travel.
 *
 * A tenth of a second is enough that an ordinary swipe reads as one and short
 * enough that a slow deliberate pull is still judged on where it actually got
 * to. It is the same trick UIKit plays for the same reason.
 */
export const PROJECTION_MS = 100

/**
 * Does a release let go of the surface?
 *
 * Where the finger was HEADED, not only where it stopped. Distance alone —
 * which is what this measured — means a 60px flick fast enough to be
 * unmistakable does nothing while a 90px crawl dismisses, and that mismatch
 * between what the hand did and what happened is most of what reads as an
 * unresponsive gesture.
 *
 * Projection rather than "far enough OR fast enough", because the two-rule
 * version has to put a floor on the fast branch and any floor is wrong: at
 * `speed > 0.4 && dx > 12`, a 13px nudge at an ordinary drag speed dismisses a
 * page nobody meant to leave. Adding the projected travel to the real travel
 * couples them the way the hand does — a fast gesture needs less distance,
 * exactly in proportion to how fast it is, and a still one needs all of it.
 */
export function commits({
  dx,
  speed,
  threshold,
}: {
  /** Signed travel; only rightward can dismiss. */
  dx: number
  /** px/ms at the moment the finger left, signed the same way. */
  speed: number
  threshold: number
}): boolean {
  // Leftward is not a dismissal at any speed — including a leftward drag that
  // whips back rightward on release, which projection alone would take.
  if (dx <= 0) return false
  return dx + speed * PROJECTION_MS > threshold
}

export function useSwipeToDismiss({
  onDismiss,
  enabled = true,
  threshold = 80,
  exit = false,
  guard,
}: {
  onDismiss: () => void
  enabled?: boolean
  /**
   * Horizontal distance (px) past which release dismisses — after the finger's
   * speed has been projected forward. See `commits`.
   */
  threshold?: number
  /**
   * Asked once, as the finger lands: may this gesture be a dismissal at all?
   *
   * The case it exists for is a live text selection. Dragging a selection
   * handle is horizontal too, and the old guard ran at the moment of dismissal
   * — far too late, since by then the surface has already followed the finger
   * across the screen and has to be put back. Deciding on touchdown means a
   * gesture that was never ours is never taken.
   */
  guard?: () => boolean
  /**
   * Does the surface see itself out, or does its parent?
   *
   * The right-side panels are rendered with an `open` flag and animate out when
   * the parent unsets it, so for them `onDismiss` must fire at once — waiting
   * would sit them back at zero for a fifth of a second before their own exit
   * even began. The page reader has no such flag: it is simply unmounted, so it
   * has to finish leaving before it says so. Opt in, and pair it with a CSS
   * rule on `[data-leaving]` lasting `EXIT_MS`.
   */
  exit?: boolean
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  /*
   * The distance and the speed, as refs as well as state.
   *
   * State is for drawing; these are for deciding. `touchend` fires whether or
   * not React has flushed the render from the last `touchmove` — and on a fast
   * flick the two land in the same frame — so reading state here meant a quick
   * swipe measured itself as zero and did nothing.
   */
  const live = useRef(0)
  const speed = useRef(0)
  const last = useRef<{ x: number; t: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function reset() {
    start.current = null
    axis.current = null
    last.current = null
    live.current = 0
    speed.current = 0
    setDragX(0)
    setDragging(false)
  }

  /**
   * Commit: let the surface finish leaving, then tell the parent.
   *
   * The travel is handed to CSS rather than animated here — `dragX` goes back
   * to zero so the inline transform stops fighting the class — and `onDismiss`
   * waits out that transition. With reduced motion there is nothing to wait
   * for, so it goes immediately.
   */
  function commit() {
    reset()
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!exit || still) {
      onDismiss()
      return
    }
    setLeaving(true)
    timer.current = setTimeout(() => {
      setLeaving(false)
      onDismiss()
    }, EXIT_MS)
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (!t || leaving) return
    if (guard && !guard()) return
    start.current = { x: t.clientX, y: t.clientY }
    last.current = { x: t.clientX, t: performance.now() }
    axis.current = null
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current
    const t = e.touches[0]
    if (!s || !t || leaving) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (axis.current === null) {
      const next = axisOf(dx, dy)
      if (next === null) return // not yet said which way it is going
      axis.current = next
      if (next === 'h') setDragging(true)
    }
    if (axis.current !== 'h') return
    const prev = last.current
    if (prev) {
      /*
       * `performance.now()`, not `e.timeStamp`.
       *
       * The event's own clock is whatever produced the event: a synthetic or
       * injected touch can carry a zero or a repeated timestamp, and then every
       * `dt` is zero, `speed` never leaves zero, and the fling path is silently
       * dead — passing every test that measures distance and none that measures
       * a flick. This clock is monotonic and always means milliseconds.
       */
      const now = performance.now()
      const dt = now - prev.t
      // Sampled per move rather than averaged over the gesture: what decides a
      // fling is how fast the finger was going when it left, and a long slow
      // drag with a flick at the end is a fling.
      if (dt > 0) speed.current = (t.clientX - prev.x) / dt
      last.current = { x: t.clientX, t: now }
    }
    // Track rightward freely; resist a leftward pull, which the surface has
    // nowhere to go in — it is already against the edge it came from.
    live.current = dx > 0 ? dx : dx * 0.2
    setDragX(live.current)
  }

  function onTouchEnd() {
    const go =
      axis.current === 'h' &&
      commits({ dx: live.current, speed: speed.current, threshold })
    if (go) commit()
    else reset()
  }

  if (!enabled) return { handlers: {}, dragX: 0, dragging: false, leaving: false }
  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    dragX,
    dragging,
    leaving,
  }
}

/**
 * How long the surface takes to finish leaving, in ms.
 *
 * Its twin is the `transform` transition on `.pg-read1[data-leaving='true']
 * .pg-read1__slide` in Pages.css, and the two have to agree: shorter here and
 * the surface is unmounted mid-flight, longer and the screen sits on an empty
 * frame after it has gone. Named on both sides so a change to one goes looking
 * for the other.
 */
export const EXIT_MS = 220
