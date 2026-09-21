import { useCallback, useEffect, useRef } from 'react'

/**
 * Drag a rectangle across the wall to select pages — the way a desktop does it.
 *
 * Before this, a drag across the wall selected the TEXT on the cards, which is
 * the one outcome nobody dragging across a grid of their own pages wants. The
 * cards are objects here (open, select, delete), so the wall behaves like a
 * Finder window: press anywhere, drag, and every page the rectangle touches is
 * selected. Shift adds to what was already selected; ⌘ (Ctrl) toggles.
 *
 * ── The wall is windowed ────────────────────────────────────────────────────
 *
 * Only the cards near the viewport exist in the DOM, and a drag autoscrolls. So
 * hit-testing the mounted cards each frame would forget every page that
 * scrolled out from under the rectangle. Instead each card's rect is recorded,
 * in CONTENT coordinates, the first time the drag sees it; layout cannot change
 * mid-drag, so those rects stay true after the card unmounts and the hit set is
 * computed against all of them.
 *
 * ── What it leaves alone ────────────────────────────────────────────────────
 *
 * Mouse only — on touch a drag is a scroll, and long-press is the menu. A press
 * that never travels past the threshold is still a click, so opening a page is
 * untouched; only the click a real drag leaves behind is swallowed. A plain
 * click on the wall's empty space clears the selection, as it does everywhere.
 */

/** A press has to travel this far before it becomes a rectangle. */
const DRAG_THRESHOLD_PX = 4
/** How close to the scroller's edge the pointer must be to autoscroll. */
const EDGE_PX = 48
const MAX_SCROLL_STEP = 22

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

interface Options {
  scrollRef: React.RefObject<HTMLElement | null>
  marqueeRef: React.RefObject<HTMLElement | null>
  /** The ids that can be selected, in wall order. Echoes are excluded. */
  orderIds: string[]
  selectedIds: Set<string>
  setSelectedIds: (next: Set<string>) => void
  setAnchor: (id: string | null) => void
  clearSelection: () => void
  /** Focus a mounted card, so the keyboard (Delete, Escape) acts on the result. */
  focusCard: (wallKey: string) => boolean
  /** A drag began — the wall closes any open menu. */
  onStart?: () => void
}

interface Drag {
  pointerId: number
  /** Content coordinates of the press. */
  x0: number
  y0: number
  clientX: number
  clientY: number
  started: boolean
  mode: 'replace' | 'add' | 'toggle'
  base: Set<string>
  rects: Map<string, { rect: Rect; key: string }>
  last: Set<string>
  frame: number
  /** Pressed on a page rather than on the wall between them. */
  onCard: boolean
}

export function useWallMarquee({
  scrollRef,
  marqueeRef,
  orderIds,
  selectedIds,
  setSelectedIds,
  setAnchor,
  clearSelection,
  focusCard,
  onStart,
}: Options) {
  const dragRef = useRef<Drag | null>(null)
  const swallowClickRef = useRef(false)

  // The handlers live on window for the length of a drag, so they read the
  // latest props through a ref rather than being re-bound mid-gesture.
  const live = useRef({ orderIds, selectedIds, setSelectedIds, setAnchor, clearSelection, focusCard, onStart })
  live.current = { orderIds, selectedIds, setSelectedIds, setAnchor, clearSelection, focusCard, onStart }

  const toContent = useCallback(
    (clientX: number, clientY: number) => {
      const el = scrollRef.current!
      const box = el.getBoundingClientRect()
      return { x: clientX - box.left + el.scrollLeft, y: clientY - box.top + el.scrollTop }
    },
    [scrollRef],
  )

  /** Record every mounted, selectable page the drag hasn't seen yet. */
  const measure = useCallback(
    (drag: Drag) => {
      const el = scrollRef.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const nodes = el.querySelectorAll<HTMLElement>('[data-entry-id][data-wall-key]:not([data-echo])')
      for (const node of nodes) {
        const id = node.dataset.entryId!
        if (drag.rects.has(id)) continue
        const r = node.getBoundingClientRect()
        const left = r.left - box.left + el.scrollLeft
        const top = r.top - box.top + el.scrollTop
        drag.rects.set(id, {
          rect: { left, top, right: left + r.width, bottom: top + r.height },
          key: node.dataset.wallKey!,
        })
      }
    },
    [scrollRef],
  )

  const paint = useCallback(
    (drag: Drag) => {
      const el = scrollRef.current
      const box = marqueeRef.current
      if (!el || !box) return
      measure(drag)
      const now = toContent(drag.clientX, drag.clientY)
      // Clamp to the content so the rectangle never pokes past the scroll area.
      const x1 = Math.max(0, Math.min(el.scrollWidth, now.x))
      const y1 = Math.max(0, Math.min(el.scrollHeight, now.y))
      const band: Rect = {
        left: Math.min(drag.x0, x1),
        top: Math.min(drag.y0, y1),
        right: Math.max(drag.x0, x1),
        bottom: Math.max(drag.y0, y1),
      }
      box.style.transform = `translate(${band.left}px, ${band.top}px)`
      box.style.width = `${band.right - band.left}px`
      box.style.height = `${band.bottom - band.top}px`
      box.hidden = false

      const hits = new Set<string>()
      for (const [id, { rect }] of drag.rects) {
        if (
          rect.left < band.right &&
          rect.right > band.left &&
          rect.top < band.bottom &&
          rect.bottom > band.top
        ) {
          hits.add(id)
        }
      }

      let next: Set<string>
      if (drag.mode === 'replace') next = hits
      else if (drag.mode === 'add') next = new Set([...drag.base, ...hits])
      else {
        next = new Set(drag.base)
        for (const id of hits) {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        }
      }
      if (!sameSet(next, drag.last)) {
        drag.last = next
        live.current.setSelectedIds(next)
      }
    },
    [scrollRef, marqueeRef, measure, toContent],
  )

  /** Autoscroll while the pointer rests near an edge, repainting as it goes. */
  const tick = useCallback(() => {
    const drag = dragRef.current
    const el = scrollRef.current
    if (!drag || !drag.started || !el) return
    const box = el.getBoundingClientRect()
    let step = 0
    if (drag.clientY < box.top + EDGE_PX) {
      step = -Math.ceil(((box.top + EDGE_PX - drag.clientY) / EDGE_PX) * MAX_SCROLL_STEP)
    } else if (drag.clientY > box.bottom - EDGE_PX) {
      step = Math.ceil(((drag.clientY - (box.bottom - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_STEP)
    }
    step = Math.max(-MAX_SCROLL_STEP * 2, Math.min(MAX_SCROLL_STEP * 2, step))
    if (step !== 0) el.scrollTop += step
    paint(drag)
    drag.frame = requestAnimationFrame(tick)
  }, [scrollRef, paint])

  const finish = useCallback(
    (cancelled: boolean) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag) return
      cancelAnimationFrame(drag.frame)
      if (marqueeRef.current) marqueeRef.current.hidden = true
      document.documentElement.removeAttribute('data-wall-marquee')

      if (!drag.started) {
        // A click on the wall between the pages, with nothing held: deselect.
        if (!cancelled && !drag.onCard && drag.mode === 'replace' && live.current.selectedIds.size > 0) {
          live.current.clearSelection()
        }
        return
      }

      swallowClickRef.current = true
      if (cancelled) {
        live.current.setSelectedIds(drag.base)
        return
      }
      // Anchor and focus on the first selected page in wall order, so shift-click
      // extends from it and Delete / Escape land on the grid.
      const first = live.current.orderIds.find((id) => drag.last.has(id))
      live.current.setAnchor(first ?? null)
      const key = first ? drag.rects.get(first)?.key : undefined
      if (key) live.current.focusCard(key)
    },
    [marqueeRef],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      drag.clientX = e.clientX
      drag.clientY = e.clientY
      if (!drag.started) {
        const origin = toContent(e.clientX, e.clientY)
        if (Math.hypot(origin.x - drag.x0, origin.y - drag.y0) < DRAG_THRESHOLD_PX) return
        drag.started = true
        document.documentElement.setAttribute('data-wall-marquee', 'true')
        // Kill any text selection the press may already have begun.
        window.getSelection()?.removeAllRanges()
        live.current.onStart?.()
        drag.frame = requestAnimationFrame(tick)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (dragRef.current?.pointerId === e.pointerId) finish(false)
    }
    const onCancel = (e: PointerEvent) => {
      if (dragRef.current?.pointerId === e.pointerId) finish(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current?.started) {
        e.preventDefault()
        finish(true)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      const drag = dragRef.current
      if (drag) cancelAnimationFrame(drag.frame)
    }
  }, [toContent, tick, finish])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      swallowClickRef.current = false
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const el = scrollRef.current
      if (!el) return
      // A press on the scrollbar is a scroll.
      const box = el.getBoundingClientRect()
      if (e.clientX >= box.left + el.clientWidth) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"], .pg__seam, [data-blank]')) {
        return
      }
      // macOS: Ctrl-click is the context menu, not a toggle.
      const mac = /Mac|iP(hone|ad)/.test(navigator.platform)
      if (mac && e.ctrlKey && !e.metaKey) return
      const origin = toContent(e.clientX, e.clientY)
      const toggle = e.metaKey || (!mac && e.ctrlKey)
      dragRef.current = {
        pointerId: e.pointerId,
        x0: origin.x,
        y0: origin.y,
        clientX: e.clientX,
        clientY: e.clientY,
        started: false,
        mode: toggle ? 'toggle' : e.shiftKey ? 'add' : 'replace',
        base: new Set(live.current.selectedIds),
        rects: new Map(),
        last: new Set(live.current.selectedIds),
        frame: 0,
        onCard: Boolean(target.closest('[data-wall-key]')),
      }
    },
    [scrollRef, toContent],
  )

  /** The click a finished drag leaves behind must not open the page under it. */
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!swallowClickRef.current) return
    swallowClickRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return { onPointerDown, onClickCapture }
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
