/** True when the line is already an ATX markdown heading. */
export function isExplicitHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim())
}

/** First non-empty line number (1-based), or null when the doc is empty. */
export function firstContentLineNumber(markdown: string): number | null {
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim()) return i + 1
  }
  return null
}

/** Lines that should not be auto-promoted to a title. */
function isNonTitleLine(line: string): boolean {
  const t = line.trim()
  return /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^>\s/.test(t)
}

/**
 * Day One / Diarly style: the first line is the entry title (rendered as H1).
 * Storage stays plain text; we inject `#` only for display when needed.
 */
export function markdownForDisplay(markdown: string): string {
  const lines = markdown.split('\n')
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim()) {
      idx = i
      break
    }
  }
  if (idx < 0) return markdown

  const raw = lines[idx]!
  const trimmed = raw.trim()
  if (isExplicitHeading(trimmed) || isNonTitleLine(trimmed)) return markdown

  lines[idx] = `# ${trimmed}`
  return lines.join('\n')
}
