import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveAttachmentDisplayUrl } from '@/lib/attachments'
import { usePhotoLooks } from '@/lib/photoLooks'
import { PHOTO_ROW_GAP, photoRatio } from '@/lib/photoSet'
import { supabase } from '@/lib/supabase'
import { PEEK_PHOTOS, type PagePhoto } from './pagePhotos'

/** Tallest the photos stand, in px. A row is ~25px; this is a step closer, not the page. */
const PEEK_HEIGHT = 92
/** Widest the print gets before the photos shrink to fit beside each other. */
const PEEK_MAX_WIDTH = 440
const UNKNOWN_RATIO = 4 / 3

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
  const look = usePhotoLooks(shown)
  const [urls, setUrls] = useState<(string | null)[]>([])
  const [natural, setNatural] = useState<Record<string, number>>({})
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const key = shown.map((p) => p.hash).join(',')

  useEffect(() => {
    let live = true
    setUrls([])
    void (async () => {
      if (!supabase) return
      const { data } = await supabase.auth.getSession()
      const owner = data.session?.user?.id
      if (!owner || !live) return
      const sb = supabase
      const resolved = await Promise.all(
        shown.map((p) => resolveAttachmentDisplayUrl(sb, owner, p.hash, p.ext).catch(() => null)),
      )
      if (live) setUrls(resolved)
    })()
    return () => {
      live = false
    }
    // `key` stands for `shown`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Held to the ratios a photo is ever drawn at, the same clamp the editor uses.
  const ratios = shown.map((p) => photoRatio(look(p.hash)?.ratio ?? natural[p.hash] ?? UNKNOWN_RATIO, 1))
  const gaps = PHOTO_ROW_GAP * (shown.length - 1)
  const sum = ratios.reduce((n, r) => n + r, 0)
  const height = Math.min(PEEK_HEIGHT, (PEEK_MAX_WIDTH - gaps) / sum)
  const caption = shown.find((p) => p.caption)?.caption ?? null

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const margin = 8
    const left = Math.max(margin, Math.min(window.innerWidth - w - margin, anchor.right - w))
    const below = anchor.bottom + 6 + h <= window.innerHeight - margin
    setAt({ left, top: below ? anchor.bottom + 6 : Math.max(margin, anchor.top - h - 6) })
  }, [anchor, height, caption])

  return createPortal(
    <div
      ref={ref}
      className="pg-peek"
      aria-hidden
      data-on={at ? 'true' : undefined}
      style={at ? { left: at.left, top: at.top } : { left: -9999, top: 0 }}
    >
      <div className="pg-peek__row" style={{ gap: PHOTO_ROW_GAP }}>
        {shown.map((p, i) => {
          const url = urls[i]
          const color = look(p.hash)?.color
          return (
            <span
              key={`${p.hash}-${i}`}
              className="pg-peek__photo"
              style={{ width: Math.round(ratios[i]! * height), height, background: color ?? undefined }}
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget
                    img.dataset.loaded = 'true'
                    if (img.naturalWidth && img.naturalHeight && !look(p.hash)?.ratio) {
                      const r = img.naturalWidth / img.naturalHeight
                      setNatural((prev) => (prev[p.hash] === r ? prev : { ...prev, [p.hash]: r }))
                    }
                  }}
                />
              ) : null}
            </span>
          )
        })}
      </div>
      {caption ? <p className="pg-peek__caption">{caption}</p> : null}
    </div>,
    document.body,
  )
}
