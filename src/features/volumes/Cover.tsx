import { useEffect, useState } from 'react'
import { resolveAttachmentDisplayUrl } from '@/lib/attachments'
import { supabase } from '@/lib/supabase'
import type { SpanPhoto } from '@/features/ascent/ledger/extras'
import { volumeColour, type Volume } from './volumes'

let ownerPromise: Promise<string | null> | null = null
function owner(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null)
  ownerPromise ??= supabase.auth.getSession().then((r) => r.data.session?.user?.id ?? null)
  return ownerPromise
}

/** A quiet pattern in the volume's colour, for a volume with no photos. */
function Pattern({ v }: { v: Pick<Volume, 'n'> }) {
  const r = (k: number) => (((v.n * 9301 + k * 49297) % 233280) + 233280) % 233280 / 233280
  const dots = Array.from({ length: 20 }, (_, i) => (
    <circle key={i} cx={30 + (i % 4) * 47} cy={36 + Math.floor(i / 4) * 44} r={2 + r(i) * 10} fill="#fff" opacity={0.1 + r(i + 50) * 0.28} />
  ))
  return (
    <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="200" height="260" fill={volumeColour(v)} />
      {dots}
    </svg>
  )
}

/**
 * A volume's cover, facing out — made from the volume itself: a photo from its
 * own pages when it has one, otherwise a quiet pattern in its colour. Modern
 * notebook, not an old encyclopedia spine.
 */
export function CoverArt({ volume, photo }: { volume: Pick<Volume, 'n'>; photo: SpanPhoto | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!photo) return
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
  }, [photo])
  return (
    <span className="vol-art">
      <Pattern v={volume} />
      {url ? <img src={url} alt="" loading="lazy" /> : null}
    </span>
  )
}
