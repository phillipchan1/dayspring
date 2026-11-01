import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cleanCaption } from '@/lib/photoSet'
import { pageDragOffset, settleDurationMs, settlePage, SETTLE_MS } from '@/hooks/usePagedSwipe'
import { prefersReducedMotion } from '@/hooks/usePresence'
import { axisOf, commits, speedAtRelease } from '@/hooks/useSwipeToDismiss'
import {
  clampPan,
  doubleTapZoom,
  FIT,
  isDoubleTap,
  isZoomed,
  pinchScale,
  pullProgress,
  pullScale,
  settleZoom,
  zoomAbout,
  type Point,
  type Size,
  type Zoom,
} from './viewerGesture'
import './PhotoViewer.css'

export interface ViewerPhoto {
  /** Stable identity for the thumbnail row (`<hash>.<ext>`, or a pending id). */
  key: string
  /** Null while it is still resolving or uploading. */
  url: string | null
  caption: string
  takenAt?: string | undefined
  /** Dominant colour, washed behind the photo. */
  color?: string | undefined
}

interface Props {
  photos: readonly ViewerPhoto[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  /**
   * Present while writing: the caption is typed here, under the photo it is
   * about. Absent while reading, where the caption is only shown.
   */
  onCaption?: (index: number, caption: string) => void
  /** Open with the caption field ready — a pass through the set, one Return each. */
  captioning?: boolean
}

/** A pull down past this (after projection) closes the viewer. */
const PULL_THRESHOLD = 110

/** A press that moves less than this is a tap. */
const TAP_SLOP = 10

/** How long a closing viewer takes to go. Its twin is `[data-closing]` in PhotoViewer.css. */
const CLOSE_MS = 200

/** How long the opening zoom from the thumbnail takes (`--dur-sheet`). */
const OPEN_MS = 380

const SPEED_SMOOTHING = 0.6

function takenLine(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** What the pointers on the stage are doing. */
type Gesture =
  | { kind: 'pending'; id: number; x0: number; y0: number; t0: number }
  | { kind: 'page'; id: number; x0: number; t: number; v: number; last: number }
  | { kind: 'pull'; id: number; x0: number; y0: number; t: number; v: number; last: number }
  | { kind: 'pan'; id: number; x0: number; y0: number; from: Zoom }
  | { kind: 'pinch'; d0: number; mid0: Point; from: Zoom }

/**
 * Looking at a photo, and at the photos it was put with.
 *
 * One photo at a time, whole, on a dark ground. It behaves like Photos:
 *
 *  - The set is a paged track under the finger — it follows the drag, gives a
 *    little past the first and last photo (and does not wrap from one to the
 *    other), and settles by where the finger was headed.
 *  - Pulling a photo down shrinks it and lets the ground fade, so the page
 *    underneath shows through; past the threshold it goes.
 *  - Pinch zooms, about the fingers; a double tap goes to 2× about the tap and
 *    back to fit; zoomed in, a drag pans. On a Mac the trackpad pinches too
 *    (WebKit's gesture events, or ctrl+wheel elsewhere), and Space closes the
 *    viewer, as it closes Quick Look.
 *  - It opens by growing out of the photo that was tapped, where that photo is
 *    on screen.
 *
 * While writing it is also where captions are typed: Return keeps the caption
 * and goes to the next photo, so a set of five is five sentences and no menus.
 */
export function PhotoViewer({ photos, index, onIndex, onClose, onCaption, captioning = false }: Props) {
  const count = photos.length
  const at = Math.min(Math.max(index, 0), Math.max(count - 1, 0))
  const photo = photos[at]
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  /** Wraps the frame; only the opening zoom touches its style, never React. */
  const flipRef = useRef<HTMLDivElement>(null)
  const captionRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(photo?.caption ?? '')
  const draftRef = useRef(draft)
  draftRef.current = draft
  // Whether the caption field should take focus when the photo changes.
  const wantsCaption = useRef(captioning && Boolean(onCaption))

  // ── What is drawn ──
  const [pageX, setPageX] = useState(0)
  const [pull, setPull] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoomState] = useState<Zoom>(FIT)
  const zoomRef = useRef<Zoom>(FIT)
  const setZoom = (z: Zoom) => {
    zoomRef.current = z
    setZoomState(z)
  }
  /** A finger (or the trackpad) is moving things: no transitions. */
  const [tracking, setTracking] = useState(false)
  const [settleMs, setSettleMs] = useState(SETTLE_MS)
  const [closing, setClosing] = useState<null | 'pull' | 'fade'>(null)

  // A new photo brings its own caption; whatever was being typed has been kept.
  useEffect(() => {
    setDraft(photo?.caption ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, photo?.key])

  // A new photo starts fitted.
  useEffect(() => {
    zoomRef.current = FIT
    setZoomState(FIT)
  }, [at])

  useEffect(() => {
    if (wantsCaption.current) captionRef.current?.focus()
    else rootRef.current?.focus()
  }, [at])

  /** Keep what was typed, if it changed. Called before leaving a photo. */
  const keep = useCallback(() => {
    if (!onCaption || !photo) return
    const next = cleanCaption(draftRef.current)
    if (next !== photo.caption) onCaption(at, next)
  }, [onCaption, photo, at])

  // No wrap: the first photo has nothing before it and the last nothing after,
  // as in Photos. The track rubber-bands there instead.
  const go = useCallback(
    (to: number) => {
      if (count < 2) return
      const next = Math.min(Math.max(to, 0), count - 1)
      if (next === at) return
      keep()
      onIndex(next)
    },
    [count, at, keep, onIndex],
  )

  const close = useCallback(() => {
    keep()
    onClose()
  }, [keep, onClose])

  /** Leave with a little grace: on down from a pull, or a quick fade. */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismiss = useCallback(
    (how: 'pull' | 'fade') => {
      if (closeTimer.current) return
      if (prefersReducedMotion()) {
        close()
        return
      }
      setClosing(how)
      closeTimer.current = setTimeout(close, CLOSE_MS)
    },
    [close],
  )
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === captionRef.current
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        // Esc while typing ends the typing, not the looking.
        if (typing) {
          wantsCaption.current = false
          keep()
          rootRef.current?.focus()
        } else dismiss('fade')
        return
      }
      if (typing) return
      // Space closes the viewer, as it closes Quick Look. Not a held key's
      // repeats — the press that opened something must not also close it.
      if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        if (!e.repeat) dismiss('fade')
        return
      }
      // The arrows are the viewer's while it is open. Stopped here, in capture,
      // or the reader underneath hears them too and turns its page behind the
      // photo — so closing it lands on a different entry.
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        go(at + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        go(at - 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [at, dismiss, go, keep])

  // ── Measuring ──

  function stageSize(): Size {
    const el = stageRef.current
    return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 }
  }

  /** The photo's fitted size — its layout box, which a transform does not change. */
  function photoSize(): Size {
    const img = frameRef.current?.querySelector('img')
    return { w: img?.offsetWidth ?? 0, h: img?.offsetHeight ?? 0 }
  }

  /** A client point, as an offset from the stage's centre. */
  function fromCentre(clientX: number, clientY: number): Point {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) }
  }

  // ── Opening: grow out of the photo that was tapped ──
  //
  // The thumbnail is whatever image on the page is showing this same photo; if
  // it is on screen and already decoded, the viewer's photo starts at its
  // place and size and settles into the middle. Otherwise the viewer simply
  // fades in, as it always did.
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !photo?.url) return
    const root = rootRef.current
    const flip = flipRef.current
    const img = frameRef.current?.querySelector('img')
    if (!root || !flip || !img || !img.complete || !img.offsetWidth) return
    const url = photo.url
    const source = Array.from(document.querySelectorAll('img')).find((el) => {
      if (root.contains(el) || el.getAttribute('src') !== url) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
    })
    if (!source) return
    const from = source.getBoundingClientRect()
    const to = img.getBoundingClientRect()
    if (!to.width || !to.height) return
    // The thumbnail is usually cropped square; grow from its longer side so the
    // photo never starts smaller than what was tapped.
    const s = Math.max(from.width / to.width, from.height / to.height)
    const dx = from.left + from.width / 2 - (to.left + to.width / 2)
    const dy = from.top + from.height / 2 - (to.top + to.height / 2)
    // The photo arrives by moving; only the ground and chrome fade in.
    root.dataset.flip = 'true'
    flip.style.transition = 'none'
    flip.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`
    let inner = 0
    // One frame painted at the thumbnail, then let it go.
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        flip.style.transition = `transform ${OPEN_MS}ms var(--ease-ios)`
        flip.style.transform = ''
      })
    })
    const done = setTimeout(() => {
      flip.style.transition = ''
    }, OPEN_MS + 40)
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      clearTimeout(done)
      flip.style.transition = ''
      flip.style.transform = ''
    }
    // Only on the way in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Pointers on the stage ──

  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  function beginPinch() {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return
    // A pinch takes over from whatever one finger was doing.
    setPageX(0)
    setPull({ x: 0, y: 0 })
    const mid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2)
    gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid0: mid, from: zoomRef.current }
    setTracking(true)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (closing || (e.target as HTMLElement).closest('button')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      beginPinch()
      return
    }
    if (pointers.current.size > 2) return
    gesture.current = { kind: 'pending', id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now() }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    const now = performance.now()

    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b) return
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const s = pinchScale((g.from.s * d) / g.d0)
      const mid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2)
      // Scale about where the fingers started, then follow the midpoint.
      const z = zoomAbout(g.from, s, g.mid0)
      setZoom({ s, x: z.x + (mid.x - g.mid0.x), y: z.y + (mid.y - g.mid0.y) })
      return
    }
    if (e.pointerId !== g.id) return

    if (g.kind === 'pending') {
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (isZoomed(zoomRef.current)) {
        if (Math.hypot(dx, dy) < TAP_SLOP) return
        gesture.current = { kind: 'pan', id: g.id, x0: e.clientX, y0: e.clientY, from: zoomRef.current }
        setTracking(true)
        return
      }
      const axis = axisOf(dx, dy)
      if (axis === 'h') {
        gesture.current = { kind: 'page', id: g.id, x0: e.clientX, t: now, v: 0, last: e.clientX }
        setTracking(true)
      } else if (axis === 'v' && dy > 0) {
        gesture.current = { kind: 'pull', id: g.id, x0: e.clientX, y0: e.clientY, t: now, v: 0, last: e.clientY }
        setTracking(true)
      } else if (axis === 'v') {
        // Upward: nothing to do with it. Let the press go.
        gesture.current = null
      }
      return
    }

    if (g.kind === 'pan') {
      const z = { s: g.from.s, x: g.from.x + (e.clientX - g.x0), y: g.from.y + (e.clientY - g.y0) }
      const stage = stageSize()
      setZoom(clampPan(z, photoSize(), stage, stage))
      return
    }

    if (g.kind === 'page') {
      const dt = now - g.t
      if (dt > 0) {
        const sample = (e.clientX - g.last) / dt
        g.v = g.v * (1 - SPEED_SMOOTHING) + sample * SPEED_SMOOTHING
        g.t = now
        g.last = e.clientX
      }
      setPageX(pageDragOffset({ dx: e.clientX - g.x0, index: at, count, width: stageSize().w }))
      return
    }

    // pull
    const dt = now - g.t
    if (dt > 0) {
      const sample = (e.clientY - g.last) / dt
      g.v = g.v * (1 - SPEED_SMOOTHING) + sample * SPEED_SMOOTHING
      g.t = now
      g.last = e.clientY
    }
    setPull({ x: e.clientX - g.x0, y: Math.max(0, e.clientY - g.y0) })
  }

  function endPointer(e: React.PointerEvent, cancelled: boolean) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    const now = performance.now()

    if (g?.kind === 'pinch') {
      if (pointers.current.size === 1) {
        // One finger left: it pans on from here.
        const [id, p] = [...pointers.current.entries()][0]!
        const z = zoomRef.current
        if (isZoomed(z)) {
          gesture.current = { kind: 'pan', id, x0: p.x, y0: p.y, from: z }
          return
        }
        gesture.current = null
      }
      if (pointers.current.size === 0) gesture.current = null
      setTracking(false)
      setSettleMs(SETTLE_MS)
      setZoom(settleZoom(zoomRef.current, photoSize(), stageSize(), g.mid0))
      return
    }
    if (!g || ('id' in g && g.id !== e.pointerId)) {
      if (pointers.current.size === 0) gesture.current = null
      return
    }
    gesture.current = null
    setTracking(false)

    if (g.kind === 'pending') {
      if (cancelled) return
      // A tap. Two of them, close together, zoom.
      const tap = { t: now, x: e.clientX, y: e.clientY }
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < TAP_SLOP && now - g.t0 < 300) {
        if (isDoubleTap(lastTap.current, tap)) {
          lastTap.current = null
          setSettleMs(SETTLE_MS)
          setZoom(doubleTapZoom(zoomRef.current, fromCentre(e.clientX, e.clientY), photoSize(), stageSize()))
        } else lastTap.current = tap
      }
      return
    }

    if (g.kind === 'pan') {
      setSettleMs(SETTLE_MS)
      setZoom(settleZoom(zoomRef.current, photoSize(), stageSize()))
      return
    }

    if (g.kind === 'page') {
      const w = stageSize().w
      const dx = e.clientX - g.x0
      const v = cancelled ? 0 : speedAtRelease(g.v, now - g.t)
      const target = cancelled ? at : settlePage({ index: at, count, dx, speed: v, width: w })
      const drawn = pageDragOffset({ dx, index: at, count, width: w })
      const goal = target === at ? 0 : target > at ? -w : w
      setSettleMs(settleDurationMs(Math.abs(goal - drawn), Math.max(0, Math.sign(goal - drawn) * v)))
      setPageX(0)
      if (target !== at) go(target)
      return
    }

    // pull
    const dy = Math.max(0, e.clientY - g.y0)
    const v = cancelled ? 0 : speedAtRelease(g.v, now - g.t)
    if (!cancelled && commits({ dx: dy, speed: v, threshold: PULL_THRESHOLD, width: stageSize().h })) {
      dismiss('pull')
      return
    }
    setSettleMs(SETTLE_MS)
    setPull({ x: 0, y: 0 })
  }

  // ── The trackpad (Mac) ──
  //
  // WebKit sends a trackpad pinch as gesturestart/change/end with a `scale`;
  // other engines send it as a wheel with ctrlKey. Both are taken, and the
  // wheel is ignored while a gesture is running so one pinch is not counted
  // twice. Zoomed in, a two-finger scroll pans. Non-passive, so the page itself
  // never zooms.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let gestureFrom: { z: Zoom; anchor: Point } | null = null
    let wheelIdle: ReturnType<typeof setTimeout> | null = null
    const settleSoon = (anchor: Point) => {
      if (wheelIdle) clearTimeout(wheelIdle)
      wheelIdle = setTimeout(() => {
        wheelIdle = null
        setTracking(false)
        setSettleMs(SETTLE_MS)
        setZoom(settleZoom(zoomRef.current, photoSize(), stageSize(), anchor))
      }, 160)
    }

    type GestureEvt = Event & { scale?: number; clientX?: number; clientY?: number }
    // iOS sends these for a two-finger pinch on the glass as well, alongside
    // the pointers that are already zooming it; with fingers down they are
    // only prevented, never applied, or one pinch would zoom twice.
    const fingersDown = () => pointers.current.size > 0
    const onGestureStart = (e: Event) => {
      const g = e as GestureEvt
      e.preventDefault()
      if (fingersDown()) return
      gestureFrom = { z: zoomRef.current, anchor: fromCentre(g.clientX ?? 0, g.clientY ?? 0) }
      setTracking(true)
    }
    const onGestureChange = (e: Event) => {
      const g = e as GestureEvt
      e.preventDefault()
      if (!gestureFrom || fingersDown()) return
      const s = pinchScale(gestureFrom.z.s * (g.scale ?? 1))
      setZoom(zoomAbout(gestureFrom.z, s, gestureFrom.anchor))
    }
    const onGestureEnd = (e: Event) => {
      e.preventDefault()
      if (!gestureFrom) return
      const anchor = gestureFrom?.anchor ?? { x: 0, y: 0 }
      gestureFrom = null
      setTracking(false)
      setSettleMs(SETTLE_MS)
      setZoom(settleZoom(zoomRef.current, photoSize(), stageSize(), anchor))
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (gestureFrom) return
        const anchor = fromCentre(e.clientX, e.clientY)
        const z = zoomRef.current
        setTracking(true)
        setZoom(zoomAbout(z, pinchScale(z.s * Math.exp(-e.deltaY * 0.01)), anchor))
        settleSoon(anchor)
        return
      }
      const z = zoomRef.current
      if (!isZoomed(z)) return
      e.preventDefault()
      setZoom(clampPan({ s: z.s, x: z.x - e.deltaX, y: z.y - e.deltaY }, photoSize(), stageSize(), null))
    }
    stage.addEventListener('gesturestart', onGestureStart, { passive: false })
    stage.addEventListener('gesturechange', onGestureChange, { passive: false })
    stage.addEventListener('gestureend', onGestureEnd, { passive: false })
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      if (wheelIdle) clearTimeout(wheelIdle)
      stage.removeEventListener('gesturestart', onGestureStart)
      stage.removeEventListener('gesturechange', onGestureChange)
      stage.removeEventListener('gestureend', onGestureEnd)
      stage.removeEventListener('wheel', onWheel)
    }
  }, [])

  if (!photo) return null
  const meta = takenLine(photo.takenAt)

  const stageH = stageRef.current?.clientHeight ?? (typeof window === 'undefined' ? 800 : window.innerHeight)
  const progress = pullProgress(pull.y, stageH)
  const ps = pullScale(progress)
  // The photo's own transform: the zoom, plus whatever a pull is doing to it.
  const frameTransform =
    closing === 'pull'
      ? `translate(${pull.x}px, ${pull.y + stageH * 0.35}px) scale(${ps * 0.9})`
      : `translate(${zoom.x + pull.x}px, ${zoom.y + pull.y}px) scale(${zoom.s * ps})`

  return createPortal(
    <div
      ref={rootRef}
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={count > 1 ? `Photo ${at + 1} of ${count}` : 'Photo'}
      tabIndex={-1}
      data-closing={closing ?? undefined}
      data-tracking={tracking || undefined}
      style={
        {
          ...(photo.color ? { '--viewer-tint': photo.color } : {}),
          '--viewer-pull': progress.toFixed(3),
        } as React.CSSProperties
      }
      // The surface underneath has its own back-swipe, armed by a touch that
      // reaches it. This is a portal, and React carries events through portals,
      // so they are stopped here: while a photo is open, a swipe turns photos.
      // A trackpad's sideways swipe is a wheel, and the reader turns pages on it.
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="photo-viewer__ground" aria-hidden>
        <div className="photo-viewer__wash" />
      </div>
      <div className="photo-viewer__top">
        <span className="photo-viewer__count">{count > 1 ? `${at + 1} of ${count}` : ''}</span>
        <button type="button" className="photo-viewer__close" aria-label="Close" onClick={() => dismiss('fade')}>
          ✕
        </button>
      </div>

      <div
        ref={stageRef}
        className="photo-viewer__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          className="photo-viewer__track"
          style={{
            transform: `translate3d(calc(${-at * 100}% + ${pageX}px), 0, 0)`,
            transitionDuration: `${settleMs}ms`,
          }}
        >
          {photos.map((p, i) => (
            <div className="photo-viewer__slide" key={`${p.key}:${i}`} aria-hidden={i !== at}>
              {/* Only the photo and its neighbours; the rest of a long set
                  would only be decoded to sit off screen. */}
              {Math.abs(i - at) <= 1 && (
                <div ref={i === at ? flipRef : undefined} className="photo-viewer__flip">
                  <div
                    ref={i === at ? frameRef : undefined}
                    className="photo-viewer__frame"
                    style={
                      i === at
                        ? {
                            transform: frameTransform,
                            transitionDuration: closing ? undefined : `${settleMs}ms`,
                          }
                        : undefined
                    }
                  >
                    {p.url ? (
                      <img
                        className="photo-viewer__img"
                        src={p.url}
                        alt={p.caption || 'Photo'}
                        draggable={false}
                      />
                    ) : (
                      <div className="photo-viewer__waiting" aria-label="Photo still loading" />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              className="photo-viewer__nav photo-viewer__nav--prev"
              aria-label="Previous photo"
              disabled={at === 0}
              onClick={() => go(at - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="photo-viewer__nav photo-viewer__nav--next"
              aria-label="Next photo"
              disabled={at === count - 1}
              onClick={() => go(at + 1)}
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="photo-viewer__foot">
        {onCaption ? (
          <>
            <input
              ref={captionRef}
              className="photo-viewer__caption photo-viewer__caption--field"
              type="text"
              value={draft}
              placeholder="Add a caption"
              aria-label="Caption"
              enterKeyHint={at < count - 1 ? 'next' : 'done'}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => {
                wantsCaption.current = true
              }}
              onBlur={keep}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (at < count - 1) go(at + 1)
                else close()
              }}
            />
            <p className="photo-viewer__hint" aria-hidden>
              {at < count - 1 ? 'Return for the next photo · Esc to stop' : 'Return to finish'}
            </p>
          </>
        ) : (
          photo.caption && <p className="photo-viewer__caption">{photo.caption}</p>
        )}
        {meta && <p className="photo-viewer__meta">{meta}</p>}
        {count > 1 && (
          <div className="photo-viewer__thumbs" role="tablist" aria-label="Photos in this set">
            {photos.map((p, i) => (
              <button
                key={`${p.key}:${i}`}
                type="button"
                role="tab"
                className="photo-viewer__thumb"
                aria-selected={i === at}
                aria-label={`Photo ${i + 1}`}
                style={p.color ? { backgroundColor: p.color } : undefined}
                onClick={() => go(i)}
              >
                {p.url && <img src={p.url} alt="" draggable={false} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
