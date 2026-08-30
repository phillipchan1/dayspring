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
 * **4. It only answered to a clean swipe.** What a thumb actually does is drag,
 * hesitate, drift back a little, and then decide — and every rule here punished
 * that. The axis locked to 'v' on the first slightly-downward pixel and never
 * reconsidered; the velocity was whatever the last single move sampled, so a
 * wobble as the finger lifted read as a fling backwards and cancelled a drag
 * that was most of the way across the screen; and a drag held still at 200px
 * kept whatever speed it had before it stopped. So: the axis stays open to being
 * changed its mind about until the scroll is real, the velocity is smoothed and
 * goes to zero when the finger rests, and past `POINT_OF_NO_RETURN` of the
 * screen the gesture is simply done — which is what makes it possible to drag
 * out, stop, look at what is under there, and let go.
 *
 * All of those decisions are `axisOf`, `locksToScroll`, `speedAtRelease` and
 * `commits` below — pure, and tested, because the velocity path had been dead in
 * exactly the way a rule buried in a touch handler goes dead: silently, and only
 * for the gestures nobody can reproduce by hand.
 *
 * ── The half of this that is not in this file ───────────────────────────────
 *
 * None of it fires if WebKit takes the gesture first, and it will, two ways.
 *
 * A scroller left on `touch-action: auto` is free to read the start of a
 * horizontal drag as a pan, so every surface using this hook hands the browser
 * the vertical axis and keeps the horizontal one — `.pg-read1__slide` in
 * Pages.css, `.cm-scroller` in editor/theme.ts — and this hook follows the
 * gesture on the window with a NON-passive listener so it can `preventDefault`
 * the moment the drag proves horizontal.
 *
 * And a touch that lands on running text goes to WebKit's text-interaction
 * recogniser, which is worse: `touchmove` stops arriving anywhere at all — not
 * the element, not the window, not the document — with no `touchcancel` to
 * notice, so the surface freezes mid-drag. `user-select: none` does not prevent
 * it. Only taking the text out of hit-testing does; see the note above
 * `.pg-read1__body` in Pages.css for what that costs and why it is worth it.
 */
/** Below this much travel, a gesture has not said which way it is going. */
const INTENT = 8

/**
 * Past this much vertical travel the gesture is a scroll, and stays one.
 *
 * Before it, `axisOf` is asked again on every move. A thumb setting off down and
 * to the right is not yet a scroll — it is a hand that has not finished deciding
 * — and locking it out on the first ambiguous pixel is most of why this only
 * ever answered to a clean, committed swipe. After it, the page has genuinely
 * moved under the finger, and taking the gesture back would yank it.
 */
const SCROLL_LOCK = 32

/**
 * A drag that begins this long after the finger landed is not a swipe.
 *
 * iOS puts the caret loupe and the selection handles behind a long press, and
 * dragging one of those is horizontal too. A swipe is one motion from touchdown;
 * a press that becomes a drag half a second later is somebody moving a caret,
 * and no surface has business taking it. This is what lets the gesture come off
 * the whole writing surface instead of hiding at the screen edge.
 */
export const LONG_PRESS_MS = 400

/**
 * How long the finger may rest before its speed is treated as zero.
 *
 * `speed` is only written by a move, so a drag that travels fast, stops, and is
 * held keeps its last speed for as long as it is held — and then flings on
 * release, from a standstill. Anyone who pulls a view out to see what is under
 * it and then thinks better of it has done exactly that.
 */
export const STILL_MS = 90

/**
 * How much of the screen makes a gesture a decision rather than a drift.
 *
 * Past this, release commits whatever the velocity says. Without it a drag
 * carried 60% of the way across and then wobbled back a few pixels as the finger
 * lifted projected to a negative and snapped home, which reads as the app
 * refusing something you plainly did. Every phone has a point past which the
 * view is going; this is ours.
 */
export const POINT_OF_NO_RETURN = 0.45

/**
 * How much of the newest sample a smoothed speed takes.
 *
 * Per-move speeds off a real finger are noisy — one 2ms frame with a 1px move is
 * 0.5px/ms of nothing. Averaging the whole gesture is worse, because a long slow
 * drag with a flick at the end IS a fling. This leans on the newest sample while
 * refusing to be defined by it.
 */
const SPEED_SMOOTHING = 0.6

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
  width,
}: {
  /** Signed travel; only rightward can dismiss. */
  dx: number
  /** px/ms at the moment the finger left, signed the same way. */
  speed: number
  threshold: number
  /**
   * The surface's width, for the point of no return. Omit and only the
   * projection decides — which is what the narrow side panels want.
   */
  width?: number
}): boolean {
  // Leftward is not a dismissal at any speed — including a leftward drag that
  // whips back rightward on release, which projection alone would take.
  if (dx <= 0) return false
  // Far enough across is a decision, and a decision survives a wobble.
  if (width && dx > width * POINT_OF_NO_RETURN) return true
  return dx + speed * PROJECTION_MS > threshold
}

/**
 * Has this gesture become a scroll for good?
 *
 * Asked only of a gesture already reading as vertical. Below the lock the axis
 * stays up for reconsideration on every move, which is what lets a hand that set
 * off ambiguously still be understood as going sideways.
 */
export function locksToScroll(dy: number): boolean {
  return Math.abs(dy) >= SCROLL_LOCK
}

/**
 * The speed to judge a release by: what the finger was doing, or nothing.
 *
 * A finger that has been still longer than `STILL_MS` is not travelling,
 * whatever the last move it happened to make measured.
 */
export function speedAtRelease(speed: number, idleMs: number): number {
  return idleMs > STILL_MS ? 0 : speed
}

/**
 * Is this a swipe, or a long press that turned into a drag?
 *
 * Measured from touchdown to the moment the gesture first said which way it was
 * going. See `LONG_PRESS_MS`.
 */
export function isSwipeNotPress(elapsedMs: number): boolean {
  return elapsedMs <= LONG_PRESS_MS
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
  /** When the finger landed — for telling a swipe from a long press. */
  const landed = useRef(0)
  /** The surface's own width, read once per gesture; see `POINT_OF_NO_RETURN`. */
  const span = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The window listeners this gesture is being followed with; see `follow`. */
  const bound = useRef<(() => void) | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      bound.current?.()
    },
    [],
  )

  function reset() {
    bound.current?.()
    start.current = null
    axis.current = null
    last.current = null
    live.current = 0
    speed.current = 0
    span.current = 0
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
    const now = performance.now()
    start.current = { x: t.clientX, y: t.clientY }
    last.current = { x: t.clientX, t: now }
    landed.current = now
    // The element, not the window: the side panels are narrower than the screen
    // and half of one is not half of a phone.
    span.current = e.currentTarget.getBoundingClientRect().width
    axis.current = null
    speed.current = 0
    follow()
  }

  /**
   * Follow the rest of the gesture on the WINDOW, not on the element.
   *
   * Two reasons, and the second is the one that made it necessary.
   *
   * React routes a touch by walking up from the node it landed on, so a gesture
   * held on the element is only as durable as that node — and both surfaces
   * here rewrite what is under the finger while the finger is down (the reader
   * repaints its body to light matched words and draw markings; CodeMirror
   * recycles lines). A `touchend` dispatched to a replaced node reaches no
   * handler: no end, no cancel, and the surface sits frozen halfway off the
   * screen. The window is always there.
   *
   * And it is NON-PASSIVE, which React cannot give: React registers `touchmove`
   * passively at its root, so `preventDefault` inside `onTouchMove` is a no-op.
   * Once the drag has proved horizontal this has to be able to say so, or a long
   * page's scroller can still decide the gesture was its own halfway through.
   *
   * Only `touchstart` needs the element — for the width, and for knowing the
   * gesture began on this surface at all.
   */
  function follow() {
    bound.current?.()
    const move = (ev: TouchEvent) => {
      const t = ev.touches[0]
      if (t) track(t)
      if (axis.current === 'h' && ev.cancelable) ev.preventDefault()
    }
    const end = () => release()
    const cancel = () => reset()
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
    if (!s || leaving) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    /*
     * The axis, still open to being changed its mind about.
     *
     * Asked again on every move until the gesture is EITHER horizontal (which
     * is ours, and from then on stays ours — a back-swipe must not turn into a
     * scroll halfway across) or vertically far enough along to be a real scroll.
     * The old code decided once, on the first 8 pixels, and a hand that set off
     * down-and-right was locked out of the gesture it was about to make.
     */
    if (axis.current !== 'h' && !(axis.current === 'v' && locksToScroll(dy))) {
      const next = axisOf(dx, dy)
      if (next === null) return // not yet said which way it is going
      axis.current = next
      // A press that becomes a drag is somebody moving a caret, not leaving.
      if (next === 'h' && !isSwipeNotPress(performance.now() - landed.current)) {
        axis.current = 'v'
        return
      }
      if (next === 'h') {
        /*
         * Start the travel HERE, not back at touchdown.
         *
         * A gesture that set off ambiguously and only later committed to
         * sideways has already accumulated some dx, and drawing that would
         * teleport the surface out from under the finger the instant it was
         * recognised. UIKit measures a pan from where the recogniser began for
         * the same reason. The few pixels of slop this gives away are the few
         * pixels nobody meant as travel anyway.
         */
        start.current = { x: t.clientX, y: t.clientY }
        last.current = { x: t.clientX, t: performance.now() }
        setDragging(true)
        return
      }
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
      /*
       * Smoothed towards the newest sample, not replaced by it.
       *
       * What decides a fling is how fast the finger was going when it left, so
       * this cannot be an average over the whole gesture — a long slow drag with
       * a flick at the end IS a fling. But a single sample off a real finger is
       * noise, and one jittery frame at the moment of release was enough to
       * cancel a drag most of the way across the screen.
       */
      if (dt > 0) {
        const now_speed = (t.clientX - prev.x) / dt
        speed.current = speed.current * (1 - SPEED_SMOOTHING) + now_speed * SPEED_SMOOTHING
        last.current = { x: t.clientX, t: now }
      }
    }
    /*
     * The true travel is what decides; the drawn offset is clamped at home.
     *
     * They used to be the same number, with a 0.2 resistance on the leftward
     * side. But a view that came in from the right has nowhere further left to
     * go, and iOS simply stops it there — while the hand behind an indecisive
     * drag that overshoots back past the start is still mid-gesture and must not
     * have its distance quietly rescaled.
     */
    live.current = dx
    setDragX(Math.max(0, dx))
  }

  function release() {
    bound.current?.()
    const idle = last.current ? performance.now() - last.current.t : Infinity
    const go =
      axis.current === 'h' &&
      commits({
        dx: live.current,
        speed: speedAtRelease(speed.current, idle),
        threshold,
        width: span.current,
      })
    if (go) commit()
    else reset()
  }

  if (!enabled) return { handlers: {}, dragX: 0, dragging: false, leaving: false }
  return {
    // Only the start. The rest of the gesture is followed on the window; see
    // `follow`, and the note there on why the element cannot be trusted to
    // still be under the finger when the finger lifts.
    handlers: { onTouchStart },
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
