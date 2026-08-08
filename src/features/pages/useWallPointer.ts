import { useRef } from 'react'

/**
 * The press model a page card needs.
 *
 * Lifted out of the old EntryRow, unchanged in behaviour and more necessary
 * here than it was there: the wall is the surface people reach for on an iPad,
 * and touch has no right-click. Long-press stands in for it, which means the
 * card has to distinguish a press that became a menu from a press that became a
 * tap — hence the trailing-click swallow.
 */

const LONG_PRESS_MS = 500
/** A press that travels this far was a scroll, not a hold. */
const LONG_PRESS_MOVE_PX = 10

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

export function useWallPointer(openMenuAt: (x: number, y: number) => void): WallPointer {
  const pointerTypeRef = useRef<string>('mouse')
  const longPressedRef = useRef(false)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  function cancel() {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
    originRef.current = null
  }

  return {
    handlers: {
      onPointerDown: (e) => {
        pointerTypeRef.current = e.pointerType
        longPressedRef.current = false
        if (e.pointerType === 'mouse') return
        const { clientX: x, clientY: y } = e
        originRef.current = { x, y }
        cancel()
        timerRef.current = window.setTimeout(() => {
          longPressedRef.current = true
          timerRef.current = undefined
          openMenuAt(x, y)
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e) => {
        const origin = originRef.current
        if (!origin) return
        if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > LONG_PRESS_MOVE_PX) cancel()
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
