import { useEffect, useMemo, useState } from 'react'
import {
  resolveCachedAttachmentMeta,
  resolveCachedAttachmentPreview,
} from '@/editor/attachmentImageExtension'
import type { AttachmentPhotoMeta } from '@/lib/attachmentCaption'
import { isMeaningfulCaption } from '@/lib/attachmentCaption'
import { PhotoViewer, type ViewerPhoto } from './PhotoViewer'
import type { ViewerSession } from './viewerSession'

interface Props {
  session: ViewerSession
  onIndex: (index: number) => void
  onCaption: (index: number, caption: string) => void
  onClose: () => void
}

/**
 * The viewer over the writing surface: the session's refs, resolved through the
 * same cache the editor's own photo blocks use, so a photo already on the page
 * is already here.
 */
export function EditorPhotoViewer({ session, onIndex, onCaption, onClose }: Props) {
  const [resolved, setResolved] = useState<
    Record<string, { url: string | null; meta: AttachmentPhotoMeta | null }>
  >({})

  const wanted = session.refs
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

  const photos = useMemo<ViewerPhoto[]>(
    () =>
      session.refs.map((ref, i) => {
        const key = ref.hash ? `${ref.hash}.${ref.ext}` : `pending:${ref.pendingId ?? i}`
        const hit = resolved[key]
        return {
          key,
          url: hit?.url ?? null,
          // A filename the Photos app made up is not a caption; the field starts empty.
          caption: isMeaningfulCaption(ref.alt) ? ref.alt.trim() : '',
          takenAt: hit?.meta?.takenAt,
          color: hit?.meta?.color,
        }
      }),
    [session.refs, resolved],
  )

  return (
    <PhotoViewer
      photos={photos}
      index={session.index}
      onIndex={onIndex}
      onCaption={onCaption}
      onClose={onClose}
      captioning={session.captioning}
    />
  )
}
