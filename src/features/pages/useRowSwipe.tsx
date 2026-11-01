import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { axisOf, isSwipeNotPress, locksToScroll, speedAtRelease } from '@/hooks/useSwipeToDismiss'
import { EntryMenuIcon } from '@/features/journal/entryMenuIcons'
import { PUSH_MS } from './edgeSwipe'
import { TRAY_W, fullAt, rowOffset, rowSwipeOutcome, type RowAction } from './rowSwipe'

/**
 * Trailing swipe actions for the wall's narrow rows.
 *
 * ── How it stays out of everything else's way ───────────────────────────────
 *
 * ONE handler on the wall's scroller, not one per row: the rows are memoised
 * and there are thousands of them, and wrapping each in an element to hold a
 * tray most never show is the cost the wall's own notes already refuse. The
 * row under the finger is found with `closest`, moved with an inline
 * transform, and the tray is drawn once, in a portal, over exactly the strip
 * the row has vacated — so it reads as lying behind the row without the row
 * needing anything behind it.
 *
 * Vertical scroll wins every tie. The axis is the back-swipe's (`axisOf`: a
 * drag must be clearly sideways), the gesture lets go for good once the page
 * has really scrolled (`locksToScroll`), and the window listener that can
 * `preventDefault` is bound only for the length of a touch that started on a
 * row, and dropped the moment that touch turns out to be a scroll.
 *
 * The long-press menu wins every hold. A drag that only begins after
 * `LONG_PRESS_MS` is a press that moved (`isSwipeNotPress`), and the row's own
 * long-press timer cancels on the first 10px of travel (useWallPointer).
 *
 * A tap while the tray is open only closes it — the tap is spent, as on iOS,
 * rather than opening the page under the finger. So does any scroll.
 */
export function useRowSwipe({
  enabled,
  scrollRef,
  onAction,
}: {
  enabled: boolean
  scrollRef: React.RefObject<HTMLElement | null>
  onAction: (entryId: string, action: RowAction) => void
}) {
  const [tray, setTray] = useState<{ id: string; rect: DOMRect } | null>(null)
  const revealRef = useRef<HTMLDivElement | null>(null)
  /** The row being dragged, or resting open. */
  const held = useRef<{ el: HTMLElement; id: string; rect: DOMRect } | null>(null)
  const open = useRef(false)
  const gesture = useRef<{
    row: HTMLElement
    id: string
    x: number
    y: number
    landed: number
    base: number
    axis: 'h' | 'v' | null
    last: { x: number; t: number }
    speed: number
    offset: number
  } | null>(null)
  const bound = useRef<(() => void) | null>(null)
  const revealed = useRef(0)
  const swallowUntil = useRef(0)
  const settleTimer = useRef<number | undefined>(undefined)
  const actionRef = useRef(onAction)
  actionRef.current = onAction

  function clearRow(el: HTMLElement) {
    el.style.transition = ''
    el.style.transform = ''
  }

  /** Draw the row at `offset` and the tray revealing exactly what it vacated. */
  function paint(offset: number, animate: boolean) {
    const h = held.current
    if (!h) return
    h.el.style.transition = animate ? 'transform var(--dur-push) var(--ease-ios)' : 'none'
    h.el.style.transform = `translateX(${offset}px)`
    revealed.current = -offset
    const r = revealRef.current
    if (r) {
      r.style.transition = animate ? 'width var(--dur-push) var(--ease-ios)' : 'none'
      r.style.width = `${-offset}px`
      r.toggleAttribute('data-full', -offset >= fullAt(h.rect.width))
    }
  }

  function close(animate = true) {
    const h = held.current
    if (!h) return
    open.current = false
    paint(0, animate)
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(
      () => {
        clearRow(h.el)
        if (held.current === h && !gesture.current) {
          held.current = null
          setTray(null)
        }
      },
      animate ? PUSH_MS : 0,
    )
  }

  function unbind() {
    bound.current?.()
  }

  function follow() {
    unbind()
    const move = (ev: TouchEvent) => {
      const t = ev.touches[0]
      if (t) track(t)
      if (gesture.current?.axis === 'h' && ev.cancelable) ev.preventDefault()
    }
    const end = () => release()
    const cancel = () => {
      unbind()
      const g = gesture.current
      gesture.current = null
      if (g?.axis === 'h') close()
    }
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

  /** The gesture is not ours after all — a scroll, or a press that moved. */
  function letGo() {
    unbind()
    gesture.current = null
  }

  function claim(row: HTMLElement, id: string) {
    window.clearTimeout(settleTimer.current)
    const prev = held.current
    if (prev && prev.el !== row) clearRow(prev.el)
    if (!prev || prev.el !== row) {
      const rect = row.getBoundingClientRect()
      held.current = { el: row, id, rect }
      setTray({ id, rect })
    }
  }

  function track(t: Touch) {
    const g = gesture.current
    if (!g) return
    const dx = t.clientX - g.x
    const dy = t.clientY - g.y
    if (g.axis !== 'h') {
      if (g.axis === 'v' && locksToScroll(dy)) return letGo()
      const next = axisOf(dx, dy)
      if (next === null) return
      if (next === 'v') {
        g.axis = 'v'
        return
      }
      if (!isSwipeNotPress(performance.now() - g.landed)) return letGo()
      // Rightward on a row at rest: there is nothing on the leading side.
      if (g.base === 0 && dx > 0) return letGo()
      g.axis = 'h'
      // Measure from here, as the back-swipe does, so the row does not jump.
      g.x = t.clientX
      g.last = { x: t.clientX, t: performance.now() }
      claim(g.row, g.id)
      return
    }
    const now = performance.now()
    const dt = now - g.last.t
    if (dt > 0) {
      const v = (t.clientX - g.last.x) / dt
      g.speed = g.speed * 0.4 + v * 0.6
      g.last = { x: t.clientX, t: now }
    }
    const h = held.current
    if (!h) return
    g.offset = rowOffset(g.base, t.clientX - g.x, h.rect.width)
    paint(g.offset, false)
  }

  function release() {
    unbind()
    const g = gesture.current
    gesture.current = null
    const h = held.current
    if (!g || g.axis !== 'h' || !h) return
    // A drag ends with a touchend; if the platform still finds a click in it,
    // that click belongs to the swipe, not to the page under it.
    swallowUntil.current = performance.now() + 400
    const outcome = rowSwipeOutcome({
      offset: g.offset,
      speed: speedAtRelease(g.speed, performance.now() - g.last.t),
      width: h.rect.width,
    })
    if (outcome === 'open') {
      open.current = true
      paint(-TRAY_W, true)
      return
    }
    close()
    if (outcome === 'full') actionRef.current(h.id, 'delete')
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!enabled) return
    const t = e.touches[0]
    if (!t || e.touches.length > 1) return
    const target = e.target as Element
    if (target.closest('.pgr-actions')) return
    const row = target.closest<HTMLElement>('.pgr[data-entry-id]:not([data-echo])')
    // A tray is open and this touch is somewhere else: it closes the tray, and
    // that is all it does.
    if (open.current && held.current && held.current.el !== row) {
      close()
      swallowUntil.current = performance.now() + 600
      return
    }
    if (!row) return
    const id = row.dataset.entryId
    if (!id) return
    const now = performance.now()
    gesture.current = {
      row,
      id,
      x: t.clientX,
      y: t.clientY,
      landed: now,
      base: open.current && held.current?.el === row ? -TRAY_W : 0,
      axis: null,
      last: { x: t.clientX, t: now },
      speed: 0,
      offset: 0,
    }
    follow()
  }

  function onClickCapture(e: React.MouseEvent) {
    if ((e.target as Element).closest('.pgr-actions')) return
    if (performance.now() < swallowUntil.current || open.current) {
      e.preventDefault()
      e.stopPropagation()
      if (open.current) close()
    }
  }

  function act(action: RowAction) {
    const h = held.current
    if (!h) return
    close()
    actionRef.current(h.id, action)
  }

  // The tray, when it first renders mid-drag, starts at what is already revealed.
  useLayoutEffect(() => {
    const r = revealRef.current
    const h = held.current
    if (!r || !h) return
    r.style.width = `${revealed.current}px`
    r.toggleAttribute('data-full', revealed.current >= fullAt(h.rect.width))
  }, [tray])

  // A scroll or a resize closes an open tray — its strip is no longer where
  // the row is.
  useEffect(() => {
    if (!tray) return
    const el = scrollRef.current
    const onMove = () => {
      if (!gesture.current) close()
    }
    el?.addEventListener('scroll', onMove, { passive: true })
    window.addEventListener('resize', onMove)
    return () => {
      el?.removeEventListener('scroll', onMove)
      window.removeEventListener('resize', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tray, scrollRef])

  // Turned off (the wall went back to cards, a pointer arrived) or gone: put
  // the row back where it lives.
  useEffect(() => {
    if (enabled) return
    unbind()
    gesture.current = null
    if (held.current) close(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  useEffect(
    () => () => {
      unbind()
      window.clearTimeout(settleTimer.current)
      if (held.current) clearRow(held.current.el)
    },
    [],
  )

  const node =
    tray && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="pgr-actions"
            role="group"
            aria-label="Page actions"
            style={{ top: tray.rect.top, left: tray.rect.left, width: tray.rect.width, height: tray.rect.height }}
          >
            <div ref={revealRef} className="pgr-actions__reveal">
              <button type="button" className="pgr-actions__btn" data-action="edit-date" onClick={() => act('edit-date')}>
                <EntryMenuIcon name="edit-date" />
                Change date…
              </button>
              <button type="button" className="pgr-actions__btn" data-action="delete" onClick={() => act('delete')}>
                <EntryMenuIcon name="delete" />
                Delete…
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return { onTouchStart, onClickCapture, tray: node }
}
