import { useEffect, useState } from 'react'
import { resolveAttachmentDisplayUrl } from '@/lib/attachments'
import { usePhotoLooks } from '@/lib/photoLooks'
import { PHOTO_ROW_GAP, photoRatio } from '@/lib/photoSet'
import { supabase } from '@/lib/supabase'
import type { PagePhoto } from './pagePhotos'

const UNKNOWN_RATIO = 4 / 3

/**
 * A page's photos as one row of equal height, every photo whole (D-033), at
 * whatever size the room allows (D-034). The hover print and the card both draw
 * them this way, so a photo looks the same wherever the wall shows it.
 *
 * Until a photo arrives its own colour fills its place: the print the list
 * draws, grown to size. No crop, ever: a row too wide for the room gets
 * shorter, and one too tall for it gets narrower and sits at the start.
 */
export function PhotoStrip({
  photos,
  maxWidth,
  maxHeight,
  className,
}: {
  photos: readonly PagePhoto[]
  maxWidth: number
  maxHeight: number
  className: string
}) {
  const look = usePhotoLooks(photos)
  const urls = usePhotoUrls(photos)
  const [natural, setNatural] = useState<Record<string, number>>({})

  // Held to the ratios a photo is ever drawn at, the same clamp the editor uses.
  const ratios = photos.map((p) => photoRatio(look(p.hash)?.ratio ?? natural[p.hash] ?? UNKNOWN_RATIO, 1))
  const gaps = PHOTO_ROW_GAP * (photos.length - 1)
  const sum = ratios.reduce((n, r) => n + r, 0)
  const height = Math.max(0, Math.floor(Math.min(maxHeight, (maxWidth - gaps) / sum)))

  return (
    <div className={className} style={{ display: 'flex', gap: PHOTO_ROW_GAP }} aria-hidden>
      {photos.map((p, i) => {
        const url = urls[i]
        const color = look(p.hash)?.color
        return (
          <span
            key={`${p.hash}-${i}`}
            className="pg-photo"
            style={{ width: Math.floor(ratios[i]! * height), height, background: color ?? undefined }}
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
  )
}

/**
 * Display URLs for these photos: the device's cached copy first, the network
 * after (`resolveAttachmentDisplayUrl`), so a photo seen once is there offline.
 */
function usePhotoUrls(photos: readonly PagePhoto[]): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>([])
  const key = photos.map((p) => p.hash).join(',')
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
        photos.map((p) => resolveAttachmentDisplayUrl(sb, owner, p.hash, p.ext).catch(() => null)),
      )
      if (live) setUrls(resolved)
    })()
    return () => {
      live = false
    }
    // `key` stands for `photos`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return urls
}
