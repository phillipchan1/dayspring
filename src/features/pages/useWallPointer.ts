import { useEffect, useRef } from 'react'
import { haptic } from '@/lib/haptics'

/**
 * The press model a page card needs.
 *
 * Lifted out of the old EntryRow, unchanged in behaviour and more necessary
 * here than it was there: the wall is the surface people reach for on an iPad,
 * and touch has no right-click. Long-press stands in for it, which means the
 * card has to distinguish a press that became a menu from a press that became a
 * tap — hence the trailing-click swallow.
 *
 * ── What the hold looks like ────────────────────────────────────────────────
 *
 * It used to be a bare 500ms timer: nothing happened under the finger, and then
 * a menu arrived. iOS says what a hold is doing while it does it — the item
 * gives a little as the press deepens, and when the menu comes the item lifts
 * toward you with the world dimmed behind it, then settles. So:
 *
 *   `data-pressing`  from touch-down: the card eases toward 0.97 over the hold
 *                    (after a short delay, so a plain tap never flinches).
 *   `data-lifted`    when the menu fires: up to ~1.02 with the backdrop dimmed,
 *                    for `LIFT_MS`, then back to rest.
 *
 * Both are written on the element directly, not through React state: every
 * card on the wall is a memoised component, and a re-render per touch-down
 * across a few hundred of them is exactly the latency this is meant to remove.
 * Any movement past `LONG_PRESS_MOVE_PX`, a scroll (which arrives as
 * `pointercancel`), a release or the finger leaving puts the card back at once.
 * Reduced motion: no scale at all (Pages.css) — the menu simply arrives.
 *
 * Touch and pen only. A Mac press tints, it does not shrink (DESIGN_PRINCIPLES,
 * Rulings), and a mouse has right-click.
 */

export const LONG_PRESS_MS = 500
/** A press that travels this far was a scroll, not a hold. */
export const LONG_PRESS_MOVE_PX = 10
/** How long a card stays lifted once its menu has opened, before settling. */
export const LIFT_MS = 320

export interface WallPointer {
  /** Spread onto the card element. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: () => void
    onPointerCancel: () => void
    onPointerLeave: () => void
    onContextMenu: (e: React.MouseEvent) => void
  }
  /**
   * True for exactly one click — the one a long-press leaves behind. Call it
   * first in onClick and return early when it answers true.
   */
  consumeLongPress: () => boolean
}

/** Has a hold travelled far enough to be a scroll instead? */
export function holdBroken(origin: { x: number; y: number }, x: number, y: number): boolean {
  return Math.hypot(x - origin.x, y - origin.y) > LONG_PRESS_MOVE_PX
}

export function useWallPointer(openMenuAt: (x: number, y: number) => void): WallPointer {
  const pointerTypeRef = useRef<string>('mouse')
  const longPressedRef = useRef(false)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const liftRef = useRef<number | undefined>(undefined)
  /** The card being held, for the press and lift attributes. */
  const elRef = useRef<HTMLElement | null>(null)

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current)
      window.clearTimeout(liftRef.current)
    },
    [],
  )

  function cancel() {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
    originRef.current = null
    elRef.current?.removeAttribute('data-pressing')
  }

  return {
    handlers: {
      onPointerDown: (e) => {
        pointerTypeRef.current = e.pointerType
        longPressedRef.current = false
        if (e.pointerType === 'mouse') return
        const { clientX: x, clientY: y } = e
        cancel()
        originRef.current = { x, y }
        const el = e.currentTarget as HTMLElement
        elRef.current = el
        el.setAttribute('data-pressing', 'true')
        timerRef.current = window.setTimeout(() => {
          longPressedRef.current = true
          timerRef.current = undefined
          originRef.current = null
          el.removeAttribute('data-pressing')
          el.setAttribute('data-lifted', 'true')
          window.clearTimeout(liftRef.current)
          liftRef.current = window.setTimeout(() => el.removeAttribute('data-lifted'), LIFT_MS)
          haptic('medium')
          openMenuAt(x, y)
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e) => {
        const origin = originRef.current
        if (!origin) return
        if (holdBroken(origin, e.clientX, e.clientY)) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Touch is already served by the timer above; acting here too would open
        // the menu twice on the platforms that synthesize a contextmenu event.
        if (pointerTypeRef.current === 'mouse') openMenuAt(e.clientX, e.clientY)
      },
    },
    consumeLongPress: () => {
      if (!longPressedRef.current) return false
      longPressedRef.current = false
      return true
    },
  }
}
