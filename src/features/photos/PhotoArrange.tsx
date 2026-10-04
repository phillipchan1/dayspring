import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isMeaningfulCaption } from '@/lib/attachmentCaption'
import { refKey, useResolvedRefs } from './useResolvedRefs'
import type { ViewerRef } from './viewerSession'
import './PhotoViewer.css'
import './PhotoArrange.css'

interface Props {
  /** The set as it stands in the text now. */
  refs: readonly ViewerRef[]
  /** Move the photo at `from` to place `to`. */
  onMove: (from: number, to: number) => void
  /** Take the photo at `index` off the page. */
  onRemove: (index: number) => void
  /** Photos picked to join the set, after its last photo. */
  onAdd: (files: File[]) => void
  /** Read the set again: photos still uploading have settled since. */
  onRefresh: () => void
  onClose: () => void
}

/** A press has to travel this far before it is a drag rather than a tap. */
const DRAG_PX = 6
/** How often to look again while a photo is still uploading. */
const PENDING_POLL_MS = 700

interface Drag {
  from: number
  over: number
  pointerId: number
  /** Where the press began, and where it is now. */
  x0: number
  y0: number
  x: number
  y: number
  /** Past the threshold: the photo is lifted. */
  lifted: boolean
  /** Each place's box, taken when the press began. Places do not move while dragging. */
  slots: DOMRect[]
}

/** The order a set would have with the photo at `from` dropped at `to`. */
function previewOrder(count: number, from: number, to: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved!)
  return order
}

function nearestSlot(slots: readonly DOMRect[], x: number, y: number): number {
  let best = 0
  let bestDistance = Infinity
  slots.forEach((r, i) => {
    const d = (r.left + r.width / 2 - x) ** 2 + (r.top + r.height / 2 - y) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}

/**
 * The set, laid flat to be put in order.
 *
 * Every photo in the set as a tile: drag one to where it belongs, × to take it
 * off the page, + to bring more in at the end. Each change is written to the
 * entry the moment it is made, so ⌘Z in the editor takes back any one of them
 * and closing never asks to save. It is a tool for the set, not a page, so it
 * sits on the viewer's dark ground: a photo looks the same in any voice.
 */
export function PhotoArrange({ refs, onMove, onRemove, onAdd, onRefresh, onClose }: Props) {
  const resolved = useResolvedRefs(refs)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const tileRefs = useRef<(HTMLDivElement | null)[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  /** The tile to give focus to after a keyboard move, by its new place. */
  const focusAfter = useRef<number | null>(null)

  const count = refs.length
  const pending = refs.some((ref) => !ref.hash)

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  useEffect(() => {
    if (focusAfter.current === null) return
    tileRefs.current[focusAfter.current]?.focus()
    focusAfter.current = null
  })

  // A photo added here is a placeholder until its upload lands; look again
  // until every one has.
  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(onRefresh, PENDING_POLL_MS)
    return () => window.clearInterval(id)
  }, [pending, onRefresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (dragRef.current) setDrag(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const endDrag = useCallback(
    (commit: boolean) => {
      const current = dragRef.current
      setDrag(null)
      if (commit && current?.lifted && current.over !== current.from) onMove(current.from, current.over)
    },
    [onMove],
  )

  const order = drag?.lifted ? previewOrder(count, drag.from, drag.over) : refs.map((_, i) => i)

  return createPortal(
    <div
      ref={rootRef}
      className="photo-arrange"
      role="dialog"
      aria-modal="true"
      aria-label="Arrange photos"
      tabIndex={-1}
      // Kept from the surface underneath, as the viewer does (see PhotoViewer).
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="photo-arrange__top">
        <span className="photo-arrange__count">
          {count === 1 ? '1 photo' : `${count} photos`}
        </span>
        <button type="button" className="photo-arrange__done" onClick={onClose}>
          Done
        </button>
      </div>
      <p className="photo-arrange__hint">
        {count > 1 ? 'Drag a photo to move it. The first one is drawn largest.' : 'Add photos to make this a set.'}
      </p>

      <div className="photo-arrange__grid" role="list" aria-label="Photos in this set, in order">
        {order.map((index, place) => {
          const ref = refs[index]!
          const key = refKey(ref, index)
          const hit = resolved[key]
          const lifted = drag?.lifted && drag.from === index
          const caption = isMeaningfulCaption(ref.alt) ? ref.alt.trim() : ''
          const label = `${caption || 'Photo'}, ${place + 1} of ${count}`
          let style: React.CSSProperties | undefined = hit?.meta?.color
            ? { backgroundColor: hit.meta.color }
            : undefined
          if (lifted && drag) {
            const slot = drag.slots[place]
            const home = drag.slots[drag.from]
            if (slot && home) {
              // Follow the pointer from wherever the photo now sits in the order.
              style = {
                ...style,
                translate: `${drag.x - drag.x0 + home.left - slot.left}px ${drag.y - drag.y0 + home.top - slot.top}px`,
              }
            }
          }
          return (
            <div
              key={`${key}:${index}`}
              ref={(el) => {
                tileRefs.current[place] = el
              }}
              role="listitem"
              tabIndex={0}
              aria-label={label}
              aria-description={count > 1 ? 'Alt and an arrow key moves it; Delete removes it.' : undefined}
              className={`photo-arrange__tile${lifted ? ' photo-arrange__tile--lifted' : ''}${
                ref.hash ? '' : ' photo-arrange__tile--pending'
              }`}
              style={style}
              onPointerDown={(e) => {
                if (e.button !== 0 || count < 2 || !ref.hash) return
                if ((e.target as HTMLElement).closest('button')) return
                e.currentTarget.setPointerCapture(e.pointerId)
                setDrag({
                  from: index,
                  over: index,
                  pointerId: e.pointerId,
                  x0: e.clientX,
                  y0: e.clientY,
                  x: e.clientX,
                  y: e.clientY,
                  lifted: false,
                  slots: tileRefs.current.slice(0, count).map((el) => el!.getBoundingClientRect()),
                })
              }}
              onPointerMove={(e) => {
                const current = dragRef.current
                if (!current || current.pointerId !== e.pointerId) return
                const lifted = current.lifted || Math.hypot(e.clientX - current.x0, e.clientY - current.y0) > DRAG_PX
                setDrag({
                  ...current,
                  x: e.clientX,
                  y: e.clientY,
                  lifted,
                  over: lifted ? nearestSlot(current.slots, e.clientX, e.clientY) : current.over,
                })
              }}
              onPointerUp={(e) => {
                if (dragRef.current?.pointerId === e.pointerId) endDrag(true)
              }}
              onPointerCancel={() => endDrag(false)}
              onKeyDown={(e) => {
                if ((e.key === 'Delete' || e.key === 'Backspace') && ref.hash) {
                  e.preventDefault()
                  focusAfter.current = Math.min(place, count - 2)
                  onRemove(index)
                  return
                }
                const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0
                if (!step) return
                e.preventDefault()
                const to = place + step
                if (to < 0 || to >= count) return
                if (e.altKey) {
                  focusAfter.current = to
                  onMove(index, to)
                } else {
                  tileRefs.current[to]?.focus()
                }
              }}
            >
              {hit?.url && <img className="photo-arrange__img" src={hit.url} alt="" draggable={false} />}
              {caption && <span className="photo-arrange__caption">{caption}</span>}
              {place === 0 && count > 1 && <span className="photo-arrange__first" aria-hidden>first</span>}
              {ref.hash && (
                <button
                  type="button"
                  className="photo-arrange__remove"
                  aria-label={`Remove ${caption || `photo ${place + 1}`}`}
                  title="Remove from the entry"
                  onClick={() => {
                    focusAfter.current = Math.min(place, count - 2)
                    onRemove(index)
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
        <button
          type="button"
          className="photo-arrange__add"
          onClick={() => fileRef.current?.click()}
        >
          <span className="photo-arrange__add-plus" aria-hidden>
            +
          </span>
          Add photos
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) onAdd(files)
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
