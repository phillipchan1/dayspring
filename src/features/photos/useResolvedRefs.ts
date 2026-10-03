import { useEffect, useState } from 'react'
import {
  resolveCachedAttachmentMeta,
  resolveCachedAttachmentPreview,
} from '@/editor/attachmentImageExtension'
import type { AttachmentPhotoMeta } from '@/lib/attachmentCaption'
import type { ViewerRef } from './viewerSession'

export interface ResolvedRef {
  url: string | null
  meta: AttachmentPhotoMeta | null
}

/** The key a ref is known by: `<hash>.<ext>`, or its upload's id while it is still on its way. */
export function refKey(ref: ViewerRef, index: number): string {
  return ref.hash ? `${ref.hash}.${ref.ext}` : `pending:${ref.pendingId ?? index}`
}

/**
 * Each uploaded photo's display URL and stored facts, through the same cache
 * the editor's own photo blocks use, so a photo already on the page is already
 * here. Keyed by `refKey`.
 */
export function useResolvedRefs(refs: readonly ViewerRef[]): Record<string, ResolvedRef> {
  const [resolved, setResolved] = useState<Record<string, ResolvedRef>>({})

  const wanted = refs
    .filter((ref) => ref.hash)
    .map((ref) => `${ref.hash}.${ref.ext}`)
    .join(' ')

  useEffect(() => {
    let alive = true
    for (const key of wanted ? wanted.split(' ') : []) {
      const [hash, ext] = key.split('.') as [string, string]
      void Promise.all([
        resolveCachedAttachmentPreview(hash, ext),
        resolveCachedAttachmentMeta(hash),
      ]).then(([url, meta]) => {
        if (alive) setResolved((prev) => ({ ...prev, [key]: { url, meta } }))
      })
    }
    return () => {
      alive = false
    }
  }, [wanted])

  return resolved
}
