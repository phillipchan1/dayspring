import { useCallback, useEffect, useMemo, useRef } from 'react'

/** How far the pointer has to travel from where it rested before the frame comes back. */
export const WAKE_DISTANCE_PX = 24

/**
 * How far the writing canvas sits from the window's centre — half the rail,
 * whatever width the rail has. 0 when there is no canvas to measure.
 */
function centreShift(): number {
  const canvas = document.querySelector('.journal-canvas')
  if (!canvas) return 0
  const r = canvas.getBoundingClientRect()
  return Math.round(window.innerWidth / 2 - (r.left + r.width / 2))
}

export interface Settle {
  /** The writer changed the page. Settles the frame; free after the first call. */
  onWrite: () => void
  /** Bring the frame back now. */
  wake: () => void
}

/**
 * Settle: once you start writing, the rail, the top bar and the corner
 * controls fade out, and the page glides to the window's centre. A deliberate
 * move of the pointer, a tap beside the page, or Esc brings them back. Not a
 * mode — nothing to enter, nothing to leave. The column keeps its width, so no
 * line re-wraps. Focus mode is still the deeper room, with typewriter and
 * dimming. The look of it is in global.css (search "Settle").
 *
 * It lives on `<html data-settled>` (same idiom as `data-focus-mode`) and is
 * driven from refs, not React state: the first keystroke flips one attribute
 * and every keystroke after it is a single boolean check. The wake listeners
 * exist only while settled.
 *
 * A resting hand nudges the trackpad, and a scrolling page sends synthetic
 * moves with the pointer standing still, so the first move after settling only
 * marks where the pointer is; the frame wakes once it has travelled
 * WAKE_DISTANCE_PX from there.
 */
export function useSettle(enabled: boolean, blockEsc: boolean): Settle {
  const settledRef = useRef(false)
  const detachRef = useRef<(() => void) | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const blockEscRef = useRef(blockEsc)
  blockEscRef.current = blockEsc

  const wake = useCallback(() => {
    if (!settledRef.current) return
    settledRef.current = false
    detachRef.current?.()
    detachRef.current = null
    document.documentElement.removeAttribute('data-settled')
  }, [])

  const onWrite = useCallback(() => {
    if (settledRef.current || !enabledRef.current) return
    settledRef.current = true
    const root = document.documentElement
    // Settled, the page belongs to the whole window, so it glides from the
    // centre of the space beside the rail to the window's own centre. Measured
    // once per settle, in the next frame rather than in the keystroke.
    const frame = requestAnimationFrame(() => {
      if (!settledRef.current) return
      root.style.setProperty('--settle-shift', `${centreShift()}px`)
      root.setAttribute('data-settled', '')
    })

    let origin: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      // A finger dragging the page is scrolling, not reaching for the frame.
      if (e.pointerType === 'touch') return
      if (!origin) {
        origin = { x: e.clientX, y: e.clientY }
        return
      }
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > WAKE_DISTANCE_PX) wake()
    }
    // On the journal Esc means "up a layer, out of the entry". While the frame
    // is away the first Esc only brings it back, the way a selection already
    // claims the first Esc; the next one leaves. An overlay that owns the
    // keyboard (the slash palette, a ritual) keeps its Esc.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || blockEscRef.current) return
      e.stopImmediatePropagation()
      wake()
    }
    // A tap or click anywhere but the words: beside the page, or where the
    // rail was. On an iPad this is the way back.
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.cm-content')) return
      wake()
    }
    // The shift was measured for this window size.
    const onResize = () => wake()
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    detachRef.current = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
    }
  }, [wake])

  useEffect(() => {
    if (!enabled) wake()
  }, [enabled, wake])

  useEffect(() => wake, [wake])

  return useMemo(() => ({ onWrite, wake }), [onWrite, wake])
}
