import { useEffect, useState, type RefObject } from 'react'

/** Approximate row height for list virtual scroll (entry row + date header average). */
export const ENTRY_LIST_ROW_HEIGHT_PX = 30
const ROW_HEIGHT_PX = ENTRY_LIST_ROW_HEIGHT_PX
const OVERSCAN = 10

/** Window a long flat list — only mount rows near the scroll viewport. */
export function useVirtualRange(
  scrollRef: RefObject<HTMLElement | null>,
  itemCount: number,
  enabled: boolean,
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(itemCount, 48) })

  useEffect(() => {
    if (!enabled || itemCount === 0) {
      setRange({ start: 0, end: itemCount })
      return
    }

    const el = scrollRef.current
    if (!el) return

    const measure = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT_PX) - OVERSCAN)
      const visible = Math.ceil(el.clientHeight / ROW_HEIGHT_PX) + OVERSCAN * 2
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
  }, [scrollRef, itemCount, enabled])

  return {
    start: range.start,
    end: range.end,
    rowHeight: ROW_HEIGHT_PX,
    topSpacer: range.start * ROW_HEIGHT_PX,
    bottomSpacer: Math.max(0, (itemCount - range.end) * ROW_HEIGHT_PX),
  }
}
