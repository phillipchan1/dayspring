import type { EntryReturnContext } from '@/lib/appHistory'

/**
 * Where "I'm done writing" lands.
 *
 * Writing is a layer on a page, not a place you live. Escape / ← walks one
 * layer up. New skips the reader on the way in (nothing to read yet) and must
 * not skip the stack on the way out.
 *
 * Lamp / Altar / Ascent keep their own ticket — those were a duck-out, not a
 * page being written. Pages (or no ticket) treats the editor as a page:
 * a draft that now has an id opens as that page; a blank draft pops home.
 */
export type EditorUpDestination =
  | { action: 'origin' }
  | { action: 'pages'; spreadId: string | null; subject: string | null }

export function editorUpDestination(opts: {
  entryId: string | null
  entryReturn: EntryReturnContext | null
  pagesSubject: string | null
}): EditorUpDestination {
  const { entryId, entryReturn, pagesSubject } = opts
  if (entryReturn && entryReturn.surface !== 'pages') return { action: 'origin' }

  const subject = entryReturn?.surface === 'pages' ? entryReturn.pagesSubject : pagesSubject
  // Came from the wall (or a different page) and this draft is now a page —
  // open *this* page, not the one they left. Write-from-reader keeps the
  // ticket's spread id equal to the entry, so it falls through to origin.
  if (entryReturn?.surface === 'pages' && entryId && entryReturn.pagesSpreadId !== entryId) {
    return { action: 'pages', spreadId: entryId, subject }
  }
  if (entryReturn) return { action: 'origin' }
  return { action: 'pages', spreadId: entryId, subject }
}
