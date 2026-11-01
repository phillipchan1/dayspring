import { useEffect, useState } from 'react'
import { resolveAttachmentDisplayUrl } from '@/lib/attachments'
import { supabase } from '@/lib/supabase'
import type { SpanPhoto } from './extras'
import { fmtDay } from './Passage'

let ownerPromise: Promise<string | null> | null = null
function owner(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null)
  ownerPromise ??= supabase.auth.getSession().then((r) => r.data.session?.user?.id ?? null)
  return ownerPromise
}

/** One photo from a page, resolved through the attachment cache. Tapping it
 *  opens the page it is on. */
export function SpanPhotoTile({
  photo,
  onOpenEntry,
  className = 'span-photo',
}: {
  photo: SpanPhoto
  onOpenEntry?: ((entryId: string) => void) | undefined
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void owner().then((id) => {
      if (!id || !supabase) return null
      return resolveAttachmentDisplayUrl(supabase, id, photo.hash, photo.ext).then((u) => {
        if (alive) setUrl(u)
      })
    })
    return () => {
      alive = false
    }
  }, [photo.hash, photo.ext])
  return (
    <button type="button" className={className} onClick={() => onOpenEntry?.(photo.entryId)} title={fmtDay(photo.date)}>
      {url ? <img src={url} alt={photo.alt} loading="lazy" /> : null}
      <span className="span-photo__date">{fmtDay(photo.date)}</span>
    </button>
  )
}

export function SpanPhotos({
  photos,
  onOpenEntry,
  empty,
}: {
  photos: SpanPhoto[]
  onOpenEntry?: ((entryId: string) => void) | undefined
  empty: string
}) {
  if (photos.length === 0) return <p className="ledger-quiet">{empty}</p>
  return (
    <div className="span-photos">
      {photos.slice(0, 18).map((p) => (
        <SpanPhotoTile key={`${p.entryId}${p.hash}`} photo={p} onOpenEntry={onOpenEntry} />
      ))}
    </div>
  )
}
