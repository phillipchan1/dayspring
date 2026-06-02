/** Parsed markdown task line — `[] item`, `[ ] item`, `[x] item`, or `- [ ] item`. */
export interface ParsedTaskLine {
  indent: string
  /** `- `, `* `, `+ `, or empty for bare `[]` lines. */
  bullet: string
  marker: string
  checked: boolean
  body: string
}

export const TASK_LINE_RE = /^(\s*)((?:[-*+]\s+)?)(\[(?:\s|[xX])?\])(\s*)(.*)$/

export function parseTaskLine(text: string): ParsedTaskLine | null {
  const m = TASK_LINE_RE.exec(text)
  if (!m) return null
  const marker = m[3]!
  const checked = /[xX]/.test(marker.slice(1, -1))
  return {
    indent: m[1] ?? '',
    bullet: m[2] ?? '',
    marker,
    checked,
    body: m[5] ?? '',
  }
}

export function isTaskLine(text: string): boolean {
  return TASK_LINE_RE.test(text)
}

/** Character offset where task body text begins on the line. */
export function taskBodyStart(lineText: string): number {
  const m = TASK_LINE_RE.exec(lineText)
  if (!m) return 0
  return (m[1]?.length ?? 0) + (m[2]?.length ?? 0) + (m[3]?.length ?? 0) + (m[4]?.length ?? 0)
}

/** Marker `[from, to)` within `lineText`. */
export function taskMarkerRange(lineText: string): { from: number; to: number } | null {
  const m = TASK_LINE_RE.exec(lineText)
  if (!m) return null
  const from = (m[1]?.length ?? 0) + (m[2]?.length ?? 0)
  return { from, to: from + m[3]!.length }
}

export function uncheckedTaskPrefix(parsed: ParsedTaskLine): string {
  const marker = parsed.bullet ? '[ ]' : '[]'
  return `${parsed.indent}${parsed.bullet}${marker} `
}

export function toggledMarker(parsed: ParsedTaskLine): string {
  if (parsed.checked) return parsed.bullet ? '[ ]' : '[]'
  return '[x]'
}

/** GFM task list line for HTML export / read-only preview. */
export function normalizeTaskLineForDisplay(line: string): string {
  const parsed = parseTaskLine(line)
  if (!parsed) return line
  const marker = parsed.checked ? '[x]' : '[ ]'
  const bullet = parsed.bullet || '- '
  const sep = parsed.body ? ' ' : ''
  return `${parsed.indent}${bullet}${marker}${sep}${parsed.body}`
}
