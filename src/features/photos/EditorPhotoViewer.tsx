import { useMemo } from 'react'
import { isMeaningfulCaption } from '@/lib/attachmentCaption'
import { PhotoViewer, type ViewerPhoto } from './PhotoViewer'
import { refKey, useResolvedRefs } from './useResolvedRefs'
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
  const resolved = useResolvedRefs(session.refs)

  const photos = useMemo<ViewerPhoto[]>(
    () =>
      session.refs.map((ref, i) => {
        const key = refKey(ref, i)
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
