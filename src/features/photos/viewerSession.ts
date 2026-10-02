// What the viewer is looking at while it is open over the editor.
//
// The viewer shows a set, and the set is text that changes underneath it: each
// caption typed there rewrites one photo line. So a session does not hold
// positions. It holds where the set *starts* — a caption edit happens inside
// the set and never moves that — and finds the line to rewrite fresh each time.

import { formatAttachmentMarkdown, formatPendingAttachmentMarkdown } from '@/lib/attachments'
import { findPhotoRuns, photoPlacement, type PhotoEdit, type PhotoRunRef } from '@/lib/photoSet'

export interface ViewerRef {
  hash?: string | undefined
  ext?: string | undefined
  pendingId?: string | undefined
  alt: string
}

export interface ViewerSession {
  /** Start of the set's first line. Stable for as long as the viewer is open. */
  runLineFrom: number
  index: number
  /** Opened to type captions, not just to look. */
  captioning: boolean
  refs: ViewerRef[]
}

const toViewerRef = (ref: PhotoRunRef): ViewerRef => ({
  hash: ref.hash,
  ext: ref.ext,
  pendingId: ref.pendingId,
  alt: ref.alt,
})

/** Open on the photo at `refFrom`, with the rest of its set to either side. */
export function openViewerSession(
  doc: string,
  refFrom: number,
  captioning: boolean,
): ViewerSession | null {
  const here = photoPlacement(doc, refFrom)
  if (!here) return null
  return {
    runLineFrom: here.run.refs[0]!.lineFrom,
    index: here.index,
    captioning,
    refs: here.run.refs.map(toViewerRef),
  }
}

/** The change that writes `caption` onto the session's photo at `index`. */
export function planViewerCaption(
  doc: string,
  session: Pick<ViewerSession, 'runLineFrom'>,
  index: number,
  caption: string,
): PhotoEdit | null {
  const run = findPhotoRuns(doc).find((r) => r.refs[0]!.lineFrom === session.runLineFrom)
  const ref = run?.refs[index]
  if (!run || !ref) return null
  const insert = ref.hash
    ? formatAttachmentMarkdown(ref.hash, ref.ext!, caption, ref.size)
    : formatPendingAttachmentMarkdown(ref.pendingId!, caption)
  return { from: ref.from, to: ref.to, insert, caret: run.to + insert.length - (ref.to - ref.from) }
}

/** Where the caret goes when the viewer closes: the end of the set it was showing. */
export function viewerSessionEnd(doc: string, session: Pick<ViewerSession, 'runLineFrom'>): number {
  const run = findPhotoRuns(doc).find((r) => r.refs[0]!.lineFrom === session.runLineFrom)
  return run ? run.to : session.runLineFrom
}
