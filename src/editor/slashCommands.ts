import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { applyFormat } from './formatSelection'
import type { SlashCommandId } from './slashDetect'

/**
 * Markdown formatting commands offered alongside the spiritual capture blocks.
 * These are applied directly to the document (no popover), the way Notion's
 * slash menu turns the current line into a heading/list/quote.
 */
export type FormatCommandId =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'divider'

/** What the palette emits on select: a spiritual block, or a format command. */
export type SlashSelection =
  | { kind: 'spiritual'; id: SlashCommandId }
  | { kind: 'format'; id: FormatCommandId }

export type SlashColumnKey = 'capture' | 'format'

export interface SlashItem {
  selection: SlashSelection
  column: SlashColumnKey
  /** Friendly name shown in the row. */
  label: string
  /** One-line description under the label. */
  hint: string
  /** Compact glyph or markdown marker shown in the leading badge. */
  badge: string
  /** Visual flavor for the badge (e.g. render "B" bold). */
  badgeStyle?: 'bold' | 'italic'
  /** Lowercase tokens matched against the typed query. */
  keywords: string[]
  /** Omit on touch — the OS keyboard already exposes this (emoji on iOS). */
  touchExcluded?: boolean
}

export interface SlashFilterOptions {
  /** When true, drop commands the on-screen keyboard already covers. */
  touchPrimary?: boolean
}

/** The two visible columns, in display order. Format leads — it's used most. */
export const SLASH_COLUMNS: { key: SlashColumnKey; title: string }[] = [
  { key: 'format', title: 'Format' },
  { key: 'capture', title: 'Capture' },
]

export const SLASH_ITEMS: SlashItem[] = [
  // ── Capture: spiritual blocks (open a popover) ──────────────────────────
  {
    selection: { kind: 'spiritual', id: 'scripture' },
    column: 'capture',
    label: 'Scripture',
    hint: 'Find relevant passages',
    badge: '✦',
    keywords: ['scripture', 'verse', 'passage', 'bible', 'scr'],
  },
  {
    selection: { kind: 'spiritual', id: 'pray' },
    column: 'capture',
    label: 'Prayer',
    hint: 'Log a prayer',
    badge: '🙏',
    keywords: ['pray', 'prayer'],
  },
  {
    selection: { kind: 'spiritual', id: 'sense' },
    column: 'capture',
    label: 'Sense',
    hint: 'A word or impression',
    badge: '✨',
    keywords: ['sense', 'impression', 'word'],
  },
  // The rest of the live set. Order follows the kind table (markKinds.ts)
  // rather than usage, so the column reads as one vocabulary.
  //
  // Gift and Absence are absent because they are RETIRED there — a writer read
  // the labels and did not know what they meant. `markKinds.ts` states the rule
  // ("nothing retired is OFFERED, not in the palette, not in `look for`") and
  // this file was the last place still breaking it. Pages already honours it via
  // LIVE_MARK_KINDS; entries marked before the cut still render.
  {
    selection: { kind: 'spiritual', id: 'desire' },
    column: 'capture',
    label: 'Desire',
    hint: 'Something you want',
    badge: '◠',
    keywords: ['desire', 'want', 'longing', 'hope', 'wish'],
  },
  {
    selection: { kind: 'spiritual', id: 'learned' },
    column: 'capture',
    label: 'Learned',
    // Never "Growth", and never "progress" — the hint has to stay a description
    // of what the writer did, not a claim about where they are.
    hint: 'Something you would tell yourself again',
    badge: '⊥',
    keywords: ['learned', 'learn', 'lesson', 'again'],
  },
  {
    selection: { kind: 'spiritual', id: 'story' },
    column: 'capture',
    label: 'Story',
    hint: 'A thing that happened, worth keeping',
    badge: '{',
    keywords: ['story', 'happened', 'moment', 'event'],
  },
  {
    selection: { kind: 'spiritual', id: 'ritual' },
    column: 'capture',
    label: 'Ritual',
    hint: 'Practices for the inner life',
    badge: '✶',
    keywords: ['ritual', 'practice', 'examen', 'lectio'],
  },
  {
    selection: { kind: 'spiritual', id: 'image' },
    column: 'capture',
    label: 'Image',
    hint: 'Add a photo',
    badge: '🖼',
    keywords: ['image', 'photo', 'picture', 'img'],
  },
  {
    selection: { kind: 'spiritual', id: 'emoji' },
    column: 'capture',
    label: 'Emoji',
    hint: 'Search and insert an emoji',
    badge: '🙂',
    keywords: ['emoji', 'emote', 'smiley', 'icon'],
    touchExcluded: true,
  },

  // ── Format: markdown (applied inline) ───────────────────────────────────
  {
    selection: { kind: 'format', id: 'h1' },
    column: 'format',
    label: 'Heading',
    hint: 'Large section title',
    badge: '#',
    keywords: ['heading', 'title', 'head', 'big'],
  },
  {
    selection: { kind: 'format', id: 'h2' },
    column: 'format',
    label: 'Subheading',
    hint: 'Medium section title',
    badge: '##',
    keywords: ['subheading', 'subtitle', 'sub'],
  },
  {
    selection: { kind: 'format', id: 'h3' },
    column: 'format',
    label: 'Small heading',
    hint: 'Minor section title',
    badge: '###',
    keywords: ['heading', 'minor', 'small'],
  },
  {
    selection: { kind: 'format', id: 'bold' },
    column: 'format',
    label: 'Bold',
    hint: 'Strong emphasis',
    badge: 'B',
    badgeStyle: 'bold',
    keywords: ['bold', 'strong'],
  },
  {
    selection: { kind: 'format', id: 'italic' },
    column: 'format',
    label: 'Italic',
    hint: 'Light emphasis',
    badge: 'I',
    badgeStyle: 'italic',
    keywords: ['italic', 'emphasis', 'em'],
  },
  {
    selection: { kind: 'format', id: 'underline' },
    column: 'format',
    label: 'Underline',
    hint: 'A quiet line beneath',
    badge: 'U',
    keywords: ['underline', 'under'],
  },
  {
    selection: { kind: 'format', id: 'strike' },
    column: 'format',
    label: 'Strikethrough',
    hint: 'Crossed-out text',
    badge: 'S',
    keywords: ['strike', 'strikethrough', 'cross'],
  },
  {
    // Only the default colour lives here. The other four are a bar/toolbar
    // affordance — five more rows would make this column scroll.
    selection: { kind: 'format', id: 'highlight' },
    column: 'format',
    label: 'Highlight',
    hint: 'Wash a phrase in colour',
    badge: '▮',
    keywords: ['highlight', 'marker', 'hl'],
  },
  {
    selection: { kind: 'format', id: 'code' },
    column: 'format',
    label: 'Code',
    hint: 'Inline monospace',
    badge: '</>',
    keywords: ['code', 'mono', 'inline'],
  },
  {
    selection: { kind: 'format', id: 'bullet' },
    column: 'format',
    label: 'Bullet list',
    hint: 'Unordered list',
    badge: '•',
    keywords: ['bullet', 'list', 'unordered'],
  },
  {
    selection: { kind: 'format', id: 'numbered' },
    column: 'format',
    label: 'Numbered list',
    hint: 'Ordered list',
    badge: '1.',
    keywords: ['numbered', 'ordered', 'list', 'number'],
  },
  {
    selection: { kind: 'format', id: 'todo' },
    column: 'format',
    label: 'To-do',
    hint: 'Checklist item',
    badge: '☐',
    keywords: ['todo', 'task', 'checkbox', 'check'],
  },
  {
    selection: { kind: 'format', id: 'quote' },
    column: 'format',
    label: 'Quote',
    hint: 'Block quotation',
    badge: '❝',
    keywords: ['quote', 'blockquote', 'citation'],
  },
  {
    selection: { kind: 'format', id: 'divider' },
    column: 'format',
    label: 'Divider',
    hint: 'A break across the page',
    badge: '—',
    keywords: ['divider', 'rule', 'separator', 'line'],
  },
]

function matches(item: SlashItem, q: string): boolean {
  if (!q) return true
  return item.keywords.some((k) => k.startsWith(q)) || item.label.toLowerCase().includes(q)
}

function visibleItems(options?: SlashFilterOptions): SlashItem[] {
  if (!options?.touchPrimary) return SLASH_ITEMS
  return SLASH_ITEMS.filter((i) => !i.touchExcluded)
}

/** Filter the catalog by the typed query, split into its two columns. */
export function filterSlashItems(
  query: string,
  options?: SlashFilterOptions,
): { capture: SlashItem[]; format: SlashItem[] } {
  const q = query.toLowerCase()
  const items = visibleItems(options)
  return {
    capture: items.filter((i) => i.column === 'capture' && matches(i, q)),
    format: items.filter((i) => i.column === 'format' && matches(i, q)),
  }
}

/** Filtered items as a column array in {@link SLASH_COLUMNS} display order. */
export function slashColumns(query: string, options?: SlashFilterOptions): SlashItem[][] {
  const byKey = filterSlashItems(query, options)
  return SLASH_COLUMNS.map((c) => byKey[c.key])
}

// ── Keyboard navigation over the two columns ──────────────────────────────

export interface SlashCursor {
  col: 0 | 1
  row: number
}

export type SlashNavDir = 'up' | 'down' | 'left' | 'right'

/** First selectable cell: the first non-empty column at row 0, or null. */
export function firstCursor(cols: SlashItem[][]): SlashCursor | null {
  for (let c = 0; c < cols.length; c++) {
    if ((cols[c]?.length ?? 0) > 0) return { col: c as 0 | 1, row: 0 }
  }
  return null
}

export function itemAt(cols: SlashItem[][], cursor: SlashCursor | null): SlashItem | null {
  if (!cursor) return null
  return cols[cursor.col]?.[cursor.row] ?? null
}

/**
 * Omnidirectional move. Up/down wrap within a column; left/right hop to the
 * adjacent column (no wrap), clamping the row so the cursor never lands on a
 * gap when columns differ in length. Empty target columns are ignored.
 */
export function moveCursor(cols: SlashItem[][], cursor: SlashCursor, dir: SlashNavDir): SlashCursor {
  const len = cols[cursor.col]?.length ?? 0
  if (len === 0) return firstCursor(cols) ?? cursor

  if (dir === 'down') return { ...cursor, row: (cursor.row + 1) % len }
  if (dir === 'up') return { ...cursor, row: (cursor.row - 1 + len) % len }

  const target = dir === 'right' ? cursor.col + 1 : cursor.col - 1
  if (target < 0 || target > 1) return cursor
  const targetLen = cols[target]?.length ?? 0
  if (targetLen === 0) return cursor
  return { col: target as 0 | 1, row: Math.min(cursor.row, targetLen - 1) }
}

// ── Applying a format command to the editor ───────────────────────────────

// Recognized block prefixes we strip before applying a new one, so switching
// between block types replaces the marker instead of stacking it.
const BLOCK_PREFIX_RE = /^(\s*)(#{1,6}\s+|>\s+|[-*+]\s+\[(?:\s|[xX])?\]\s+|[-*+]\s+|\d+\.\s+)/

function stripBlockPrefix(text: string): { indent: string; body: string } {
  const m = BLOCK_PREFIX_RE.exec(text)
  if (!m) {
    const indent = /^\s*/.exec(text)?.[0] ?? ''
    return { indent, body: text.slice(indent.length) }
  }
  return { indent: m[1] ?? '', body: text.slice(m[0].length) }
}

function sameBlockKind(existing: string, next: string): boolean {
  const heading = /^#{1,6}\s+$/
  const quote = /^>\s+$/
  const todo = /^[-*+]\s+\[(?:\s|[xX])?\]\s+$/
  const bullet = /^[-*+]\s+$/
  const ordered = /^\d+[.)]\s+$/
  if (heading.test(next)) return heading.test(existing) && existing === next
  if (quote.test(next)) return quote.test(existing)
  if (todo.test(next)) return todo.test(existing)
  if (bullet.test(next)) return bullet.test(existing)
  if (ordered.test(next)) return ordered.test(existing)
  return existing === next
}

function setLinePrefix(view: EditorView, prefix: string): void {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const { indent, body } = stripBlockPrefix(line.text)
  const existing = line.text.slice(indent.length, line.text.length - body.length)
  // Same mark again takes the prefix off instead of stacking `## ##`.
  const insert = sameBlockKind(existing, prefix) ? `${indent}${body}` : `${indent}${prefix}${body}`
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    // Drop the caret at the end of the (now prefixed) line, ready to type.
    selection: { anchor: line.from + insert.length },
  })
  view.focus()
}

const ORDERED_MARK_RE = /^(\s*)(\d+)[.)]\s+/

/**
 * Next `N. ` at `indent`, from the nearest preceding ordered item at that
 * indent. More-indented lines are skipped (nested content); a less-indented
 * ordered item ends the search so a nested list starts at 1.
 */
function nextOrderedPrefix(doc: Text, lineNumber: number, indent: string): string {
  for (let n = lineNumber - 1; n >= 1; n--) {
    const text = doc.line(n).text
    const m = ORDERED_MARK_RE.exec(text)
    if (!m) continue
    const foundIndent = m[1] ?? ''
    if (foundIndent === indent) {
      const num = Number.parseInt(m[2] ?? '1', 10)
      return `${Number.isFinite(num) ? num + 1 : 1}. `
    }
    if (foundIndent.length < indent.length) break
  }
  return '1. '
}

function setNumberedListPrefix(view: EditorView): void {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const { indent } = stripBlockPrefix(line.text)
  setLinePrefix(view, nextOrderedPrefix(view.state.doc, line.number, indent))
}

function insertDivider(view: EditorView): void {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  if (line.text.trim() === '') {
    const insert = '---\n'
    view.dispatch({
      changes: { from: line.from, to: line.to, insert },
      selection: { anchor: line.from + insert.length },
    })
  } else {
    const insert = '\n\n---\n'
    view.dispatch({ changes: { from: line.to, insert }, selection: { anchor: line.to + insert.length } })
  }
  view.focus()
}

/** Apply a markdown format command at the current caret. */
export function applyFormatCommand(view: EditorView, id: FormatCommandId): void {
  switch (id) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'highlight':
    case 'code':
      // Same toggle as the format bar / keymap — never a second wrap.
      applyFormat(view, id)
      return
    case 'h1':
      setLinePrefix(view, '# ')
      return
    case 'h2':
      setLinePrefix(view, '## ')
      return
    case 'h3':
      setLinePrefix(view, '### ')
      return
    case 'bullet':
      setLinePrefix(view, '- ')
      return
    case 'numbered':
      setNumberedListPrefix(view)
      return
    case 'todo':
      setLinePrefix(view, '- [ ] ')
      return
    case 'quote':
      setLinePrefix(view, '> ')
      return
    case 'divider':
      insertDivider(view)
      return
  }
}
