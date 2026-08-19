/** ESV.org deep-link helpers — opens the real site in a new tab. */
export function esvOrgChapter(book: string, chapter: number): string {
  return `https://www.esv.org/${encodeURIComponent(`${book} ${chapter}`)}/`
}

export function esvOrgVerse(book: string, chapter: number, verse: number): string {
  return `https://www.esv.org/${encodeURIComponent(`${book} ${chapter}:${verse}`)}/`
}
