import { parseReferences } from './parse'

export interface ChapterTarget {
  book: string
  chapter: number
  verse: number | null
}

/** ESV.org chapter URL — the handoff when someone wants to go further. */
export function esvOrgChapter(book: string, chapter: number): string {
  return `https://www.esv.org/${encodeURIComponent(`${book} ${chapter}`)}/`
}

/**
 * Read a scripture-block citation ("Psalm 46:10 · ESV") into book / chapter /
 * optional highlight verse. Returns null when nothing parseable is there.
 */
export function chapterFromCitation(citation: string | null | undefined): ChapterTarget | null {
  if (!citation?.trim()) return null
  const normalized = citation.trim().replace(/\b([a-z])/g, (c) => c.toUpperCase())
  const refs = parseReferences(normalized)
  if (refs.length === 0) return null
  const r = refs[0]!
  return { book: r.book_name, chapter: r.chapter, verse: r.verse_start }
}
