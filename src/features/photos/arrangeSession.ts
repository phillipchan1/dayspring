// What the arrange sheet is showing while it is open over the editor.
//
// Like the viewer, it holds where the set *starts* and nothing else. Every
// change it makes (a photo moved, taken away, added at the end) leaves the
// set's first line where it was, so the set is found fresh each time from the
// live text and the sheet can never act on a photo that has moved under it.

import {
  findPhotoRuns,
  photoPlacement,
  planMoveTo,
  planRemovePhoto,
  type PhotoEdit,
  type PhotoRun,
} from '@/lib/photoSet'
import type { ViewerRef } from './viewerSession'

export interface ArrangeSession {
  /** Start of the set's first line. */
  runLineFrom: number
}

/** Open on the set the photo at `refFrom` is in — a lone photo is a set of one. */
export function openArrangeSession(doc: string, refFrom: number): ArrangeSession | null {
  const here = photoPlacement(doc, refFrom)
  return here ? { runLineFrom: here.run.refs[0]!.lineFrom } : null
}

/** The set as it stands now. Null once it is gone (its last photo removed). */
export function arrangeRun(doc: string, session: ArrangeSession): PhotoRun | null {
  return findPhotoRuns(doc).find((r) => r.refs[0]!.lineFrom === session.runLineFrom) ?? null
}

/** Its photos, for the sheet to draw. */
export function arrangeRefs(doc: string, session: ArrangeSession): ViewerRef[] {
  return (arrangeRun(doc, session)?.refs ?? []).map((ref) => ({
    hash: ref.hash,
    ext: ref.ext,
    pendingId: ref.pendingId,
    alt: ref.alt,
  }))
}

/** The change that moves the photo at `from` to place `to`. */
export function planArrangeMove(
  doc: string,
  session: ArrangeSession,
  from: number,
  to: number,
): PhotoEdit | null {
  const ref = arrangeRun(doc, session)?.refs[from]
  return ref ? planMoveTo(doc, ref.from, to) : null
}

/** The change that takes the photo at `index` off the page. */
export function planArrangeRemove(doc: string, session: ArrangeSession, index: number): PhotoEdit | null {
  const ref = arrangeRun(doc, session)?.refs[index]
  return ref ? planRemovePhoto(doc, ref.from, ref.to) : null
}

/** Where photos added from the sheet go: after the set's last photo. */
export function arrangeAddAfter(doc: string, session: ArrangeSession): number | null {
  const run = arrangeRun(doc, session)
  return run ? run.refs[run.refs.length - 1]!.from : null
}
