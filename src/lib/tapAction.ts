import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'

/** Ignore a second event from the same physical tap (pointerup + click + touchend). */
export const TAP_GUARD_MS = 500

/**
 * Primary-button check that survives WebKit's touch quirks.
 * Touch pointerdown on iOS has reported `button === 0` and `button === -1`.
 */
export function isPrimaryTapButton(button: number | undefined): boolean {
  return button === 0 || button === -1 || button === undefined
}

/**
 * Travel, in CSS px, that turns a press into a scroll or a drag. UIScrollView
 * takes a touch over at about this distance; a button under it must let go.
 */
export const TAP_TRAVEL_PX = 10

/**
 * Whether this pointer is a finger (or behaves like one), whatever it calls
 * itself.
 *
 * iPadOS 26 WKWebView often reports a finger as `pointerType: "mouse"` (or "").
 * #84 only armed touch/pen, so those taps fell through to `click` — and iPad
 * still drops `click` after synthesized mouseenter → mousedown → mouseleave,
 * even when nothing in React setState. Phones can hit the same path.
 */
export function isTouchLikePointer(
  pointerType: string | undefined,
  opts?: { maxTouchPoints?: number; coarse?: boolean },
): boolean {
  const type = pointerType ?? ''
  if (type === 'touch' || type === 'pen' || type === '') return true
  if (type !== 'mouse') return true

  const touchPoints =
    opts?.maxTouchPoints ??
    (typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints)
  if (touchPoints > 0) return true
  if (opts?.coarse === true) return true
  if (opts?.coarse === false) return false
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(pointer: coarse)').matches) return true
      if (window.matchMedia('(hover: none)').matches) return true
    } catch {
      /* jsdom / old WebKit */
    }
  }
  return false
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function fireGuarded(
  last: { current: number },
  enabled: { current: boolean },
  action: { current: () => void },
): void {
  if (!enabled.current) return
  const t = now()
  if (t - last.current < TAP_GUARD_MS) return
  last.current = t
  action.current()
}

/** One press, from the first event that saw it go down. */
type Gesture = {
  x: number | undefined
  y: number | undefined
  touch: boolean
  /** The finger travelled, or the browser took the touch to scroll. */
  cancelled: boolean
  /** When a cancelled press first tried to release — see `release`. */
  releasedAt?: number
}

/**
 * Reliable tap binding for iOS / iPadOS WKWebView — and touch-up-inside.
 *
 * #84 fired only on touch/pen pointerdown and otherwise waited for click.
 * That is still dead on device: iPadOS synthesizes `pointerType: "mouse"` for
 * a finger, then drops the click after its mouseenter/leave dance. #86 made
 * every release commit — pointerup for every primary pointer, then mouseup /
 * touchend if Pointer Events never arrive, then click for keyboard and as last
 * resort — and a short time guard keeps one gesture from firing twice. The
 * guard is time-based so a lost click cannot stick and swallow the next tap.
 *
 * It no longer commits on the way *down*. These are the buy, restore and sign
 * in buttons, and the paywall scrolls: a thumb that began a scroll on a plan
 * tile opened the App Store sheet. A native button acts on touch-up inside,
 * and lets go of a press that becomes a scroll (DESIGN_PRINCIPLES N2) — so a
 * finger that travels more than `TAP_TRAVEL_PX`, or a press the browser
 * cancels to scroll, commits nothing on any of the release paths. A desktop
 * mouse never cancels by travel: it acts if it is released over the button,
 * which is the only place its pointerup lands. Keyboard activation (a click
 * with `detail === 0`) always acts.
 */
export function useTapAction(action: () => void, enabled = true) {
  // A page can receive its first tap inside the first 500ms of performance.now().
  // Start outside the guard window so that first gesture is never discarded.
  const last = useRef(Number.NEGATIVE_INFINITY)
  const actionRef = useRef(action)
  const enabledRef = useRef(enabled)
  const gesture = useRef<Gesture | null>(null)
  actionRef.current = action
  enabledRef.current = enabled

  const fire = () => fireGuarded(last, enabledRef, actionRef)

  const begin = (x: number | undefined, y: number | undefined, touch: boolean) => {
    gesture.current = { x, y, touch, cancelled: false }
  }

  const travel = (x: number | undefined, y: number | undefined) => {
    const g = gesture.current
    if (!g || !g.touch || g.cancelled) return
    if (x === undefined || y === undefined || g.x === undefined || g.y === undefined) return
    if (Math.hypot(x - g.x, y - g.y) > TAP_TRAVEL_PX) g.cancelled = true
  }

  const cancel = () => {
    if (gesture.current) gesture.current.cancelled = true
  }

  const release = () => {
    const g = gesture.current
    if (g?.cancelled) {
      // Every release path of the cancelled press stays quiet (touchend still
      // arrives after a scroll). Past the guard window it is a new press whose
      // down was never seen — the lost-event case #86 exists for — so act.
      const t = now()
      g.releasedAt ??= t
      if (t - g.releasedAt < TAP_GUARD_MS) return
    }
    gesture.current = null
    fire()
  }

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryTapButton(event.button)) return
      begin(event.clientX, event.clientY, isTouchLikePointer(event.pointerType))
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      travel(event.clientX, event.clientY)
    },
    onPointerCancel: () => {
      cancel()
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryTapButton(event.button)) return
      travel(event.clientX, event.clientY)
      release()
    },
    onMouseUp: (event: ReactMouseEvent<HTMLElement>) => {
      if (!isPrimaryTapButton(event.button)) return
      release()
    },
    onTouchStart: (event: ReactTouchEvent<HTMLElement>) => {
      // The same press may already have begun on pointerdown; a touch stream
      // with no Pointer Events begins here.
      if (gesture.current && !gesture.current.cancelled) return
      const t = event.touches?.[0]
      begin(t?.clientX, t?.clientY, true)
    },
    onTouchMove: (event: ReactTouchEvent<HTMLElement>) => {
      const t = event.touches?.[0]
      travel(t?.clientX, t?.clientY)
    },
    onTouchEnd: (event: ReactTouchEvent<HTMLElement>) => {
      const t = event.changedTouches?.[0]
      travel(t?.clientX, t?.clientY)
      release()
    },
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (event.detail === 0) {
        fire()
        return
      }
      release()
    },
  }
}

/** True when AuthenticationServices reports the user dismissed the sheet. */
export function isOAuthCanceled(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return /cancel|canceled|cancelled|error 1\.|error 1\)|ASWebAuthenticationSessionError/i.test(
    msg,
  )
}
