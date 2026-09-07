import { useEffect, useState, type RefObject } from 'react'

/**
 * Rows kept mounted beyond the viewport, so a fast scroll never shows a gap.
 *
 * Measured in SCREENS rather than rows, because a row is 25px at one end of the
 * Pages zoom and 620px at the other. A flat ten rows is half a screen of buffer
 * in the list and TWENTY screens of it at reading zoom — where each row is a
 * whole page of markdown to render, so clicking into a page parsed twenty-one
 * of them to show one.
 */
/*
 * About one screen either side, with a floor. Half a screen was too thin: a
 * fast scroll at card zoom outran the listener and showed empty space, which is
 * the exact failure the overscan exists to prevent. The floor matters most at
 * reading zoom, where one screen is a single row.
 */
const OVERSCAN_MIN = 4
const OVERSCAN_MAX = 12

function overscanFor(clientHeight: number, rowHeight: number): number {
  const perScreen = Math.max(1, Math.ceil(clientHeight / rowHeight))
  return Math.min(OVERSCAN_MAX, Math.max(OVERSCAN_MIN, perScreen))
}

/**
 * Window a long list of uniform-height rows — only mount what's near the viewport.
 *
 * @param rowHeight  Height of one row in px.
 *                   The Pages wall passes its own, which changes with density —
 *                   the caller owns the number so CSS and this math can't drift.
 */
export function useVirtualRange(
  scrollRef: RefObject<HTMLElement | null>,
  itemCount: number,
  enabled: boolean,
  rowHeight: number,
) {
  const ROW_HEIGHT_PX = rowHeight
  const [range, setRange] = useState({ start: 0, end: Math.min(itemCount, 48) })

  useEffect(() => {
    if (!enabled || itemCount === 0) {
      setRange({ start: 0, end: itemCount })
      return
    }

    const el = scrollRef.current
    if (!el) return

    const measure = () => {
      const overscan = overscanFor(el.clientHeight, ROW_HEIGHT_PX)
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT_PX) - overscan)
      const visible = Math.ceil(el.clientHeight / ROW_HEIGHT_PX) + overscan * 2
      const end = Math.min(itemCount, start + visible)
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [scrollRef, itemCount, enabled, ROW_HEIGHT_PX])

  return {
    start: range.start,
    end: range.end,
    rowHeight: ROW_HEIGHT_PX,
    topSpacer: range.start * ROW_HEIGHT_PX,
    bottomSpacer: Math.max(0, (itemCount - range.end) * ROW_HEIGHT_PX),
  }
}
