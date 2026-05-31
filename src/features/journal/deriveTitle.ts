/**
 * Derive a display title from markdown body: first non-empty line, with leading
 * heading/quote/list markers stripped. Returns '' when there's no content yet.
 */
export function deriveTitle(markdown: string): string {
  const line = markdown
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!line) return ''
  return line
    .replace(/^#{1,6}\s+/, '') // headings
    .replace(/^>\s+/, '') // quotes
    .replace(/^[-*+]\s+/, '') // bullets
    .replace(/^\d+\.\s+/, '') // ordered list
    .replace(/[*_`~]/g, '') // inline emphasis marks
    .trim()
}
