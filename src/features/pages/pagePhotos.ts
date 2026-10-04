// The photos on a page, as the list needs them: which, in what order, and the
// caption she gave each one, if she gave one (D-034).
//
// Read from the markdown alone, like every other fact on the wall. A photo still
// uploading (`attachment-pending:`) is not counted: it has no hash to colour a
// print with, and on the next save it becomes a photo like any other.

import { isMeaningfulCaption } from '@/lib/attachmentCaption'
import { ATTACHMENT_REF_RE } from '@/lib/attachments'

export interface PagePhoto {
  hash: string
  ext: string
  /** Her caption, or null — a filename the camera made up is not one. */
  caption: string | null
}

export const NO_PHOTOS: readonly PagePhoto[] = Object.freeze([])

/** Every photo on the page, in the order she put them there. */
export function pagePhotos(markdown: string | null | undefined): readonly PagePhoto[] {
  if (!markdown || !markdown.includes('](attachment:')) return NO_PHOTOS
  const out: PagePhoto[] = []
  for (const m of markdown.matchAll(ATTACHMENT_REF_RE)) {
    const alt = (m[1] ?? '').trim()
    out.push({ hash: m[2]!, ext: m[3]!, caption: isMeaningfulCaption(alt) ? alt : null })
  }
  return out.length > 0 ? out : NO_PHOTOS
}

/**
 * How many prints a row draws: up to three, fanned.
 *
 * A row has about 1.6rem for this. Three overlapping prints read as "several";
 * a fourth only makes the fan longer without saying anything new, and a count
 * beside it would be a number on her page, which the wall never prints.
 */
export const ROW_PRINTS = 3

/** How many photos the hover print shows. Past four, each is too small to recognise. */
export const PEEK_PHOTOS = 4
