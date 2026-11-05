import { useCallback, useEffect, useRef, useState } from 'react'
import { PROJECTION_MS, speedAtRelease } from './useSwipeToDismiss'
import { STRANDED_MS, prefersReducedMotion, waitForExit } from './usePresence'

/**
 * Drag-to-dismiss for a bottom sheet, grabbable anywhere on the sheet.
 *
 * The grabber alone is a ~36px target most thumbs never find, so the whole
 * surface is draggable — but the sheet's body scrolls, and a gesture can only
 * mean one thing. The rules, in the order they're decided:
 *
 *  1. Lock to an axis on the first 8px, so a horizontal flick across the tab
 *     strip and a plain tap never move the sheet.
 *  2. A gesture starting inside a region marked `data-sheet-scroll` is that
 *     region's to keep *unless* it is already scrolled to the very top — the
 *     one position where a downward drag has no scrolling left to do. This is
 *     what stops the sheet sliding away when you meant to scroll back up. An
 *     upward drag that starts in such a region is a scroll, full stop.
 *  3. Anywhere else, an upward pull lifts the sheet a little and no further —
 *     a rubber band (`RUBBER_BAND`), the way a UIKit sheet answers a finger
 *     pushing it somewhere it has no room to go — and it settles home.
 *
 * Pair `data-sheet-scroll` with `overscroll-behavior: contain` so the scroller
 * doesn't rubber-band underneath the drag.
 *
 * ── What it learned from useSwipeToDismiss (NATIVE_FEEL_AUDIT §3) ───────────
 *
 * This used to decide on distance alone (110px), vanish wherever the finger let
 * go, and `setState` on every `touchmove`. It now does what the reader's
 * back-swipe already did well:
 *
 *  - **Where the finger was headed.** Speed is smoothed towards the newest
 *    sample and projected `PROJECTION_MS` ahead; a flick faster than
 *    `FLICK_SPEED` dismisses on its own, a throw back up never does, and a slow
 *    pull has to carry a quarter of the sheet's height (`SHEET_SHARE`).
 *  - **It leaves from where it is.** On release the sheet is left exactly where
 *    the finger put it, so the parent's exit (usePresence / useExit, CSS
 *    `data-state="closing"`) carries it the rest of the way down from there,
 *    instead of the sheet jumping home and then disappearing.
 *  - **The drag is written to the DOM, not to React.** Attach `ref` to the
 *    element that moves and the hook writes its `translate` directly while the
 *    finger is down: no render per frame of the gesture. (`translate`, not
 *    `transform`, because an entrance animation with a `both` fill owns
 *    `transform` for good — and because a closing animation on `transform`
 *    composes with it, which is how the exit starts from the release point.)
 *
 * Callers that don't attach `ref` get the old contract unchanged: a live
 * `dragY` (now rubber-banded, so it can dip below zero) to draw with, a
 * `dragging` flag to suppress the transition, and `onDismiss` the moment the
 * gesture commits.
 *
 * The gesture is followed on the window with a non-passive listener, like
 * useSwipeToDismiss: React's own `touchmove` is passive, so it could never stop
 * the sheet's scroller from moving under a drag that had already been claimed,
 * and a node re-rendered under the finger would drop the `touchend`.
 */

/** Below this much travel, a gesture has not said which way it is going. */
const INTENT = 8

/** How much of an upward drag the sheet follows. */
export const RUBBER_BAND = 0.15

/** px/ms. A release at least this fast downward dismisses on its own. */
export const FLICK_SPEED = 0.5

/**
 * A flick still has to have gone somewhere. Without a floor, a tap that slid
 * a few pixels on its way to a button inside the sheet read as a flick.
 */
export const FLICK_MIN_TRAVEL = 12

/** Share of the sheet's height a slow pull must carry to dismiss. */
export const SHEET_SHARE = 0.25

/** Smallest distance that dismisses, for short sheets. */
const MIN_DISTANCE = 64

/** When the sheet's height can't be measured. The old fixed threshold. */
export const DEFAULT_THRESHOLD = 110

/** How much of the newest speed sample a smoothed speed takes. */
const SPEED_SMOOTHING = 0.6

/**
 * Settling home, and leaving on its own (`exit`). Named so a change goes
 * looking for its CSS twins: `--dur-push` / `--ease-spring` and `--dur-exit`.
 */
const SETTLE = 'translate var(--dur-push, 300ms) var(--ease-spring, cubic-bezier(0.2, 0.7, 0.2, 1))'
const SETTLE_MS = 300
const LEAVE = 'translate var(--dur-exit, 150ms) var(--ease-out, ease-out)'
const LEAVE_MS = 150

/** How far a slow pull has to go, given the sheet's height. */
export function dismissDistance(height: number, threshold?: number): number {
  if (threshold !== undefined) return threshold
  if (!(height > 0)) return DEFAULT_THRESHOLD
  return Math.max(MIN_DISTANCE, height * SHEET_SHARE)
}

/** What the sheet draws for a given travel: all of it down, a little of it up. */
export function rubberBand(dy: number): number {
  return dy >= 0 ? dy : dy * RUBBER_BAND
}

/**
 * Does this release let go of the sheet?
 *
 * Projection, as in useSwipeToDismiss's `commits`, with the two rules a sheet
 * adds: a real flick downward is a dismissal however short, and a flick back
 * up is the hand changing its mind however far it had got.
 */
export function sheetCommits({
  dy,
  speed,
  distance,
}: {
  /** Downward travel (px) since the drag was recognised. */
  dy: number
  /** px/ms at release, positive downward. */
  speed: number
  distance: number
}): boolean {
  if (dy <= 0) return false
  if (speed <= -FLICK_SPEED) return false
  if (speed >= FLICK_SPEED && dy >= FLICK_MIN_TRAVEL) return true
  return dy + speed * PROJECTION_MS > distance
}

export function useSheetDismiss({
  onDismiss,
  enabled = true,
  threshold,
  exit = false,
}: {
  onDismiss: () => void
  enabled?: boolean
  /**
   * Downward distance (px) past which a slow release dismisses. Default: a
   * quarter of the sheet's height, measured as the finger lands.
   */
  threshold?: number
  /**
   * With `ref` attached: should the sheet carry itself off the screen before
   * `onDismiss`? For a sheet whose parent simply unmounts it. A sheet behind
   * usePresence / useExit leaves this off — its own exit takes over from the
   * release point, and waiting here would hold the scrim up behind it.
   */
  exit?: boolean
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const blocked = useRef(false)
  /** The gesture landed in a `data-sheet-scroll` region. */
  const inScroller = useRef(false)
  /*
   * The distance and speed, as refs. State is for drawing; these are for
   * deciding — `touchend` can land in the same frame as the last `touchmove`,
   * before React has rendered it, and a quick flick then measured itself as
   * zero.
   */
  const live = useRef(0)
  /**
   * Where the sheet already was when the finger landed: caught mid-settle, a
   * gesture takes over from where the sheet IS (N3: interruptible), not from
   * where it was going.
   */
  const base = useRef(0)
  const speed = useRef(0)
  const last = useRef<{ y: number; t: number } | null>(null)
  const height = useRef(0)
  const node = useRef<HTMLElement | null>(null)
  const bound = useRef<(() => void) | null>(null)
  const settling = useRef<(() => void) | null>(null)
  const stranded = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const leavingRef = useRef(false)
  const latest = useRef(onDismiss)
  latest.current = onDismiss
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const ref = useCallback((el: HTMLElement | null) => {
    node.current = el
  }, [])

  useEffect(
    () => () => {
      bound.current?.()
      settling.current?.()
      if (stranded.current !== undefined) clearTimeout(stranded.current)
    },
    [],
  )

  /** Draw the travel: straight onto the element, or into state for the old contract. */
  function draw(y: number) {
    const el = node.current
    if (el) el.style.translate = y ? `0 ${y}px` : ''
    else setDragY(y)
  }

  function forget() {
    bound.current?.()
    start.current = null
    axis.current = null
    blocked.current = false
    inScroller.current = false
    last.current = null
    live.current = 0
    base.current = 0
    speed.current = 0
  }

  /**
   * A finger landed on a sheet still settling home: stop it where it is and
   * hand back that offset, so the new drag carries on from there.
   */
  function catchSettle(): number {
    const el = node.current
    if (!el || !settling.current) return 0
    settling.current()
    settling.current = null
    const raw = getComputedStyle(el).translate
    const y = raw && raw !== 'none' ? parseFloat(raw.split(/\s+/)[1] ?? '0') || 0 : 0
    el.style.transition = 'none'
    el.style.translate = y ? `0 ${y}px` : ''
    return y
  }

  /** Back home: sprung on the element, or by the caller's own CSS transition. */
  function settle() {
    const moved = live.current !== 0
    forget()
    setDragging(false)
    const el = node.current
    if (!el) {
      setDragY(0)
      return
    }
    if (!moved || prefersReducedMotion()) {
      el.style.transition = ''
      el.style.translate = ''
      return
    }
    el.style.transition = SETTLE
    el.style.translate = '0 0'
    settling.current?.()
    settling.current = waitForExit(
      el,
      () => {
        settling.current = null
        el.style.transition = ''
        el.style.translate = ''
      },
      SETTLE_MS + 80,
    )
  }

  /** Let go of the sheet, from wherever it is. */
  function commit() {
    forget()
    setDragging(false)
    const el = node.current
    if (!el) {
      // The old contract: dismiss now, and the caller unmounts.
      setDragY(0)
      latest.current()
      return
    }
    leavingRef.current = true
    setLeaving(true)
    // Hand the curve to the exit: it starts at the finger's speed, so it
    // shouldn't start from rest the way an exit from a standstill does.
    el.dataset.released = 'true'
    el.style.transition = ''
    const done = () => {
      latest.current()
      stranded.current = setTimeout(() => {
        // Still here: the parent didn't take it. Come back rather than hang
        // half off the screen ignoring every touch.
        leavingRef.current = false
        setLeaving(false)
        delete el.dataset.released
        live.current = 1
        settle()
      }, STRANDED_MS)
    }
    if (exit && !prefersReducedMotion()) {
      el.style.transition = LEAVE
      el.style.translate = '0 100%'
      settling.current = waitForExit(el, () => {
        settling.current = null
        done()
      }, LEAVE_MS + 80)
      return
    }
    done()
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (!t || leavingRef.current || e.touches.length > 1) return
    // React bubbles through portals: a touch in a drawer this sheet opened is
    // not a touch on this sheet.
    const target = e.target as Node | null
    if (target && !(e.currentTarget as Node).contains(target)) return
    start.current = { x: t.clientX, y: t.clientY }
    axis.current = null
    speed.current = 0
    live.current = 0
    last.current = { y: t.clientY, t: performance.now() }
    // Decide ownership up front, from where the finger landed. Checking
    // scrollTop mid-gesture would read a value the scroller had already begun
    // changing, and the sheet would fight the scroll.
    const scroller = (e.target as Element | null)?.closest?.('[data-sheet-scroll]')
    inScroller.current = scroller !== null && scroller !== undefined
    blocked.current = inScroller.current && scroller!.scrollTop > 0
    // A scroll: a sheet still settling home is left to finish doing so.
    if (blocked.current) return
    base.current = catchSettle()
    live.current = base.current
    height.current = (node.current ?? (e.currentTarget as HTMLElement)).getBoundingClientRect().height
    follow()
  }

  function follow() {
    bound.current?.()
    const move = (ev: TouchEvent) => {
      const t = ev.touches[0]
      if (t) track(t)
      if (axis.current === 'v' && !blocked.current && ev.cancelable) ev.preventDefault()
    }
    const end = () => release()
    const cancel = () => settle()
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
    if (!s || blocked.current) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (axis.current === null) {
      if (Math.abs(dx) < INTENT && Math.abs(dy) < INTENT) return // wait for intent
      axis.current = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h'
      if (axis.current === 'h') {
        bound.current?.()
        if (base.current !== 0) settle()
        return
      }
      // Upward from inside a scroller is that scroller's.
      if (dy < 0 && inScroller.current) {
        blocked.current = true
        bound.current?.()
        if (base.current !== 0) settle()
        return
      }
      // Measure from HERE, not from touchdown: the slop is not travel, and
      // counting it would jump the sheet 8px the instant it was recognised.
      start.current = { x: t.clientX, y: t.clientY }
      last.current = { y: t.clientY, t: performance.now() }
      const el = node.current
      if (el) el.style.transition = 'none'
      setDragging(true)
      return
    }
    if (axis.current !== 'v') return
    const prev = last.current
    const now = performance.now()
    if (prev) {
      const dt = now - prev.t
      if (dt > 0) {
        const sample = (t.clientY - prev.y) / dt
        speed.current = speed.current * (1 - SPEED_SMOOTHING) + sample * SPEED_SMOOTHING
        last.current = { y: t.clientY, t: now }
      }
    }
    live.current = base.current + dy
    draw(rubberBand(live.current))
  }

  function release() {
    bound.current?.()
    if (axis.current !== 'v' || blocked.current) {
      // Caught mid-settle and then let go without a drag: finish settling.
      if (base.current !== 0) settle()
      else {
        forget()
        setDragging(false)
      }
      return
    }
    const idle = last.current ? performance.now() - last.current.t : Infinity
    const go = sheetCommits({
      dy: live.current,
      speed: speedAtRelease(speed.current, idle),
      distance: dismissDistance(height.current, threshold),
    })
    if (go) commit()
    else settle()
  }

  // Switched off mid-drag (a sheet that starts working, say): put it back.
  useEffect(() => {
    if (enabled || !start.current) return
    settle()
    // settle is stable in what it reads (refs); run only on the switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  if (!enabled) return { handlers: {}, dragY: 0, dragging: false, leaving, ref }
  return {
    // Only the start. The rest of the gesture is followed on the window.
    handlers: { onTouchStart },
    dragY,
    dragging,
    /** Committed, and on its way out. */
    leaving,
    /** Attach to the element that moves, to have the drag drawn on it directly. */
    ref,
  }
}
