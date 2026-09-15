import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

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
 * Whether pointerdown should commit the action (before iPad's mouse dance).
 *
 * iPadOS 26 WKWebView often reports a finger as `pointerType: "mouse"` (or "").
 * #84 only armed touch/pen, so those taps fell through to `click` — and iPad
 * still drops `click` after synthesized mouseenter → mousedown → mouseleave,
 * even when nothing in React setState. Phones can hit the same path.
 */
export function shouldCommitOnPointerDown(
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

function fireGuarded(
  last: { current: number },
  enabled: { current: boolean },
  action: { current: () => void },
): void {
  if (!enabled.current) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - last.current < TAP_GUARD_MS) return
  last.current = now
  action.current()
}

/**
 * Reliable tap binding for iOS / iPadOS WKWebView.
 *
 * #84 fired only on touch/pen pointerdown and otherwise waited for click.
 * That is still dead on device: iPadOS synthesizes `pointerType: "mouse"` for
 * a finger, then drops the click after its mouseenter/leave dance.
 *
 * Commit on (1) pointerdown when the pointer is not a fine desktop mouse,
 * (2) pointerup for every primary pointer, (3) mouseup / touchend if Pointer
 * Events never arrive, (4) click for keyboard and as last resort. A short
 * guard prevents the same gesture from firing twice. The guard is time-based
 * so a lost click cannot stick and swallow the next tap.
 */
export function useTapAction(action: () => void, enabled = true) {
  // A page can receive its first tap inside the first 500ms of performance.now().
  // Start outside the guard window so that first gesture is never discarded.
  const last = useRef(Number.NEGATIVE_INFINITY)
  const actionRef = useRef(action)
  const enabledRef = useRef(enabled)
  actionRef.current = action
  enabledRef.current = enabled

  const fire = () => fireGuarded(last, enabledRef, actionRef)

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryTapButton(event.button)) return
      if (!shouldCommitOnPointerDown(event.pointerType)) return
      fire()
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryTapButton(event.button)) return
      fire()
    },
    onMouseUp: (event: ReactMouseEvent<HTMLElement>) => {
      if (!isPrimaryTapButton(event.button)) return
      fire()
    },
    onTouchEnd: () => {
      fire()
    },
    onClick: () => {
      fire()
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
