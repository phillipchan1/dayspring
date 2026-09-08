import { parseReferences } from './parse'

export interface ChapterTarget {
  book: string
  chapter: number
  verse: number | null
  /** Inclusive end of a same-chapter range; null when the citation is a single verse or a whole chapter. */
  verseEnd: number | null
}

export type CitedEdge = 'solo' | 'start' | 'mid' | 'end'

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
  return {
    book: r.book_name,
    chapter: r.chapter,
    verse: r.verse_start,
    verseEnd: r.verse_end,
  }
}

/** One-chapter heading: "Jeremiah 2:13", "Psalm 46:10–12". Psalms reads in the singular. */
export function formatChapterHeading({ book, chapter, verse, verseEnd }: ChapterTarget): string {
  const name = book === 'Psalms' ? 'Psalm' : book
  if (verse == null) return `${name} ${chapter}`
  if (verseEnd != null && verseEnd !== verse) return `${name} ${chapter}:${verse}–${verseEnd}`
  return `${name} ${chapter}:${verse}`
}

/** Whether verse `n` is the citation the pane opened on. */
export function verseIsCited(n: number, verse: number | null | undefined, verseEnd?: number | null): boolean {
  if (verse == null) return false
  const end = verseEnd ?? verse
  const lo = Math.min(verse, end)
  const hi = Math.max(verse, end)
  return n >= lo && n <= hi
}

/** Where `n` sits in a cited span — used to join a range into one band. */
export function citedVerseEdge(
  n: number,
  verse: number | null | undefined,
  verseEnd?: number | null,
): CitedEdge | null {
  if (!verseIsCited(n, verse, verseEnd) || verse == null) return null
  const end = verseEnd ?? verse
  const lo = Math.min(verse, end)
  const hi = Math.max(verse, end)
  if (lo === hi) return 'solo'
  if (n === lo) return 'start'
  if (n === hi) return 'end'
  return 'mid'
}
