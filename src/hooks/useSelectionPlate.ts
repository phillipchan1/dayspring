import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * One selection plate that slides between the options of a segmented control
 * or a pill set, instead of the chosen tile jumping from one to the next.
 *
 * A UISegmentedControl's thumb travels; ours blinked off one option and on at
 * another (NATIVE_FEEL_AUDIT §3, DESIGN_PRINCIPLES N3: state changes take
 * 100–200ms on a deceleration curve). The plate is the group's own `::before`
 * (global.css: `.segmented`, `.pill-set`), placed from four custom properties
 * this hook writes on the group: `--plate-x`, `--plate-y`, `--plate-w`,
 * `--plate-h`. The chosen option is found by `[data-active="true"]` or
 * `[aria-pressed="true"]`, so neither control has to change how it marks it.
 *
 * `data-plate` on the group says what the plate is doing:
 *   absent   not measured yet — the chosen option draws its own tile, as before
 *   "still"  placed, but not moving (the first placement, and after a resize)
 *   "on"     placed, and slides to the next choice
 *   "none"   nothing is chosen — the plate fades away where it was
 *
 * Measuring is `offsetLeft`/`offsetWidth` on a choice, once per change; nothing
 * here runs per frame or per keystroke.
 */
export function useSelectionPlate<T extends HTMLElement = HTMLElement>(
  /** Whatever identifies the choice; the plate moves when it changes. */
  selected: unknown,
): (node: T | null) => void {
  const [group, setGroup] = useState<T | null>(null)
  const frame = useRef(0)

  const place = useCallback(
    (moving: boolean) => {
      if (!group) return
      const chosen = group.querySelector<HTMLElement>(
        ':scope > [data-active="true"], :scope > [aria-pressed="true"]',
      )
      if (!chosen) {
        if (group.dataset.plate) group.dataset.plate = 'none'
        return
      }
      const s = group.style
      s.setProperty('--plate-x', `${chosen.offsetLeft}px`)
      s.setProperty('--plate-y', `${chosen.offsetTop}px`)
      s.setProperty('--plate-w', `${chosen.offsetWidth}px`)
      s.setProperty('--plate-h', `${chosen.offsetHeight}px`)
      const was = group.dataset.plate
      if (moving && was && was !== 'none') {
        group.dataset.plate = 'on'
        return
      }
      // Put it in place without travel, then let it travel from the next frame
      // on — a transition enabled in the same frame as the first placement
      // would slide the plate in from the corner.
      group.dataset.plate = 'still'
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        if (group.dataset.plate === 'still') group.dataset.plate = 'on'
      })
    },
    [group],
  )

  // The choice changed: slide.
  useLayoutEffect(() => {
    place(true)
  }, [place, selected])

  // The options changed size (a font arriving, the window narrowing): re-place,
  // without sliding across for something nobody did.
  useLayoutEffect(() => {
    if (!group || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(group)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [group, place])

  return setGroup as (node: T | null) => void
}
