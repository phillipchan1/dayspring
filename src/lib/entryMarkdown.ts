import { isSpiritualFenceLine } from './spiritualBlocks'
import { isTaskLine, normalizeTaskLineForDisplay } from './taskListMarkdown'

/** True when the line is already an ATX markdown heading. */
export function isExplicitHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim())
}

/**
 * CommonMark thematic break: three or more matching `-`, `_`, or `*` on
 * their own line, with optional spaces between. Shared by the title heuristic
 * so a leading `---` is a divider, not an H1.
 */
export function isThematicBreak(line: string): boolean {
  return /^\s{0,3}(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})[ \t]*$/.test(line)
}

/** First non-empty line number (1-based), or null when the doc is empty. */
export function firstContentLineNumber(markdown: string): number | null {
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim()) return i + 1
  }
  return null
}

/**
 * Lines that should not be auto-promoted to a title — a leading list item,
 * ordered item, quote, task, or fence is content, not a heading. Shared by the
 * live editor decoration and the display/export transform so they always agree.
 */
export function isNonTitleLine(line: string): boolean {
  const t = line.trim()
  return (
    t.startsWith('/') ||
    /^[-*+]\s/.test(t) ||
    /^\d+\.\s/.test(t) ||
    /^>\s/.test(t) ||
    /^(?:[-*+]\s+)?\[(?:\s|[xX])?\]\s*/.test(t) ||
    isSpiritualFenceLine(t) ||
    t === '```' ||
    isThematicBreak(t)
  )
}

/** True when this first content line should render as the entry title. */
export function firstLineIsTitle(line: string): boolean {
  const t = line.trim()
  return t !== '' && !isExplicitHeading(t) && !isNonTitleLine(t)
}

export interface DisplayOptions {
  /** Promote a plain first line to an H1 title. Defaults to true. */
  asTitle?: boolean
}

/**
 * Day One / Diarly style: the *first line* is the entry title (rendered as H1).
 * Storage stays plain text; we inject `#` only for display, and only when title
 * styling is enabled (`asTitle`).
 *
 * The title is strictly positional — line 1 only. If a blank line (or a leading
 * spiritual block) pushes the first words down, the writer has opted out of a
 * title and the text stays body, never auto-promoted. Task lines are normalized
 * to GFM either way so downstream renderers show real checkboxes.
 */
export function markdownForDisplay(markdown: string, opts: DisplayOptions = {}): string {
  const asTitle = opts.asTitle ?? true
  const lines = markdown.split('\n')

  if (asTitle && firstLineIsTitle((lines[0] ?? '').trim())) {
    lines[0] = `# ${lines[0]!.trim()}`
  }

  return lines.map((line) => (isTaskLine(line) ? normalizeTaskLineForDisplay(line) : line)).join('\n')
}
