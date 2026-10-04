import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cleanCaption } from '@/lib/photoSet'
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

/** A swipe has to travel this far, and be this much more one way than the other. */
const SWIPE_PX = 44
const SWIPE_DOWN_PX = 90

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

/**
 * Looking at a photo, and at the photos it was put with.
 *
 * One photo at a time, whole, on a dark ground; arrow keys, the two buttons or
 * a sideways swipe move through the set, and the thumbnails say where you are.
 * While writing it is also where captions are typed: Return keeps the caption
 * and goes to the next photo, so a set of five is five sentences and no menus.
 */
export function PhotoViewer({ photos, index, onIndex, onClose, onCaption, captioning = false }: Props) {
  const count = photos.length
  const at = Math.min(Math.max(index, 0), Math.max(count - 1, 0))
  const photo = photos[at]
  const rootRef = useRef<HTMLDivElement>(null)
  const captionRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(photo?.caption ?? '')
  const draftRef = useRef(draft)
  draftRef.current = draft
  // Whether the caption field should take focus when the photo changes.
  const wantsCaption = useRef(captioning && Boolean(onCaption))

  // A new photo brings its own caption; whatever was being typed has been kept.
  useEffect(() => {
    setDraft(photo?.caption ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, photo?.key])

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

  const go = useCallback(
    (to: number) => {
      if (count < 2) return
      keep()
      onIndex((to + count) % count)
    },
    [count, keep, onIndex],
  )

  const close = useCallback(() => {
    keep()
    onClose()
  }, [keep, onClose])

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
        } else close()
        return
      }
      if (typing) return
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
  }, [at, close, go, keep])

  const drag = useRef<{ x: number; y: number } | null>(null)

  if (!photo) return null
  const meta = takenLine(photo.takenAt)

  return createPortal(
    <div
      ref={rootRef}
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={count > 1 ? `Photo ${at + 1} of ${count}` : 'Photo'}
      tabIndex={-1}
      style={photo.color ? ({ '--viewer-tint': photo.color } as React.CSSProperties) : undefined}
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
      <div className="photo-viewer__wash" aria-hidden />
      <div className="photo-viewer__top">
        <span className="photo-viewer__count">{count > 1 ? `${at + 1} of ${count}` : ''}</span>
        <button type="button" className="photo-viewer__close" aria-label="Close" onClick={close}>
          ✕
        </button>
      </div>

      <div
        className="photo-viewer__stage"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={(e) => {
          const from = drag.current
          drag.current = null
          if (!from) return
          const dx = e.clientX - from.x
          const dy = e.clientY - from.y
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(at + (dx < 0 ? 1 : -1))
          else if (dy > SWIPE_DOWN_PX && dy > Math.abs(dx) * 1.5) close()
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        {photo.url ? (
          <img className="photo-viewer__img" src={photo.url} alt={photo.caption || 'Photo'} draggable={false} />
        ) : (
          <div className="photo-viewer__waiting" aria-label="Photo still loading" />
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              className="photo-viewer__nav photo-viewer__nav--prev"
              aria-label="Previous photo"
              onClick={() => go(at - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="photo-viewer__nav photo-viewer__nav--next"
              aria-label="Next photo"
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
