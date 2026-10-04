import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PEEK_PHOTOS, type PagePhoto } from './pagePhotos'
import { PhotoStrip } from './PhotoStrip'

/** Tallest the photos stand, in px. A row is ~25px; this is a step closer, not the page. */
const PEEK_HEIGHT = 92
/** Widest the print gets before the photos shrink to fit beside each other. */
const PEEK_MAX_WIDTH = 440

export interface PeekAnchor {
  /** The hovered row, in viewport coordinates. */
  top: number
  bottom: number
  /** The right edge of the row's prints, so the photos rise out of them. */
  right: number
}

/**
 * The prints, one step closer (D-034).
 *
 * Hover a row with photos and its prints become the photos themselves: the set
 * as rows of equal height, every photo whole (D-033), on a print's paper, with
 * her caption under them if she wrote one. Under the row rather than beside it,
 * so it never covers the sentence you are pointing at.
 *
 * Nothing to press, so nothing to focus: it is looking, not a control, and it
 * leaves the moment the pointer does. Opening the page is still the row's click.
 */
export function PhotoPeek({ photos, anchor }: { photos: readonly PagePhoto[]; anchor: PeekAnchor }) {
  const shown = photos.length > PEEK_PHOTOS ? photos.slice(0, PEEK_PHOTOS) : photos
  const caption = shown.find((p) => p.caption)?.caption ?? null
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)

  // Placed once it has a size, and again whenever that size changes (a photo
  // whose shape was unknown arrives and the row re-lays itself).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      const margin = 8
      const left = Math.max(margin, Math.min(window.innerWidth - w - margin, anchor.right - w))
      const below = anchor.bottom + 6 + h <= window.innerHeight - margin
      const top = below ? anchor.bottom + 6 : Math.max(margin, anchor.top - h - 6)
      setAt((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }))
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      className="pg-peek"
      aria-hidden
      data-on={at ? 'true' : undefined}
      style={at ? { left: at.left, top: at.top } : { left: -9999, top: 0 }}
    >
      <PhotoStrip photos={shown} maxWidth={PEEK_MAX_WIDTH} maxHeight={PEEK_HEIGHT} className="pg-peek__row" />
      {caption ? <p className="pg-peek__caption">{caption}</p> : null}
    </div>,
    document.body,
  )
}
