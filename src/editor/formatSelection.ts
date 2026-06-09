import type { ChangeSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export type FormatAction = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list' | 'quote' | 'heading'

export type InlineMark = 'bold' | 'italic' | 'strike' | 'code'

export interface InlineMarks {
  bold: boolean
  italic: boolean
  strike: boolean
  code: boolean
}

export interface FormatState {
  inline: InlineMarks
  link: boolean
  /** Line-level style when every touched line agrees; otherwise null. */
  line: 'list' | 'quote' | 'heading' | null
}

const EMPTY_INLINE: InlineMarks = { bold: false, italic: false, strike: false, code: false }

const INLINE_MARKER: Record<InlineMark, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
}

const LINE_STYLES: { action: 'list' | 'quote' | 'heading'; prefixes: string[] }[] = [
  { action: 'heading', prefixes: ['### ', '## ', '# '] },
  { action: 'quote', prefixes: ['> '] },
  { action: 'list', prefixes: ['- ', '* '] },
]

/**
 * True when `t` is a single span wrapped by `marker` — i.e. the closing marker
 * is the *first* occurrence after the opening one. This rejects selections that
 * merely share an outer delimiter but hold several spans (`**a** and **b**`),
 * which would otherwise be mis-peeled and corrupted on re-wrap.
 */
function isWrapped(t: string, marker: string): boolean {
  const k = marker.length
  if (t.length < k * 2) return false
  if (!t.startsWith(marker) || !t.endsWith(marker)) return false
  return t.indexOf(marker, k) === t.length - k
}

/** Peel recognized markdown wrappers until the plain phrase is exposed. */
export function parseInlineMarks(text: string): { plain: string; marks: InlineMarks } {
  let t = text
  const marks: InlineMarks = { ...EMPTY_INLINE }

  for (let guard = 0; guard < 8; guard++) {
    if (isWrapped(t, '`')) {
      marks.code = true
      t = t.slice(1, -1)
      continue
    }
    if (isWrapped(t, '***')) {
      marks.bold = true
      marks.italic = true
      t = t.slice(3, -3)
      continue
    }
    if (isWrapped(t, '**')) {
      marks.bold = true
      t = t.slice(2, -2)
      continue
    }
    if (isWrapped(t, '~~')) {
      marks.strike = true
      t = t.slice(2, -2)
      continue
    }
    if (isWrapped(t, '*')) {
      marks.italic = true
      t = t.slice(1, -1)
      continue
    }
    break
  }

  return { plain: t, marks }
}

const LINK_RE = /^\[([\s\S]*)\]\(([^)]+)\)$/

export function parseLink(text: string): { plain: string; url: string } | null {
  const m = LINK_RE.exec(text.trim())
  if (!m) return null
  return { plain: m[1] ?? '', url: m[2] ?? '' }
}

/** Rebuild inline markdown from plain text + marks (stable, non-nested marker soup). */
export function buildInline(plain: string, marks: InlineMarks): string {
  if (!plain) return plain
  if (marks.code) return `\`${plain}\``

  let s = plain
  if (marks.strike) s = `~~${s}~~`
  if (marks.bold && marks.italic) s = `***${s}***`
  else if (marks.bold) s = `**${s}**`
  else if (marks.italic) s = `*${s}*`
  return s
}

function stripLinePrefix(text: string): { body: string; prefix: string | null } {
  for (const style of LINE_STYLES) {
    for (const prefix of style.prefixes) {
      if (text.startsWith(prefix)) {
        return { body: text.slice(prefix.length), prefix }
      }
    }
  }
  return { body: text, prefix: null }
}

function lineStyleFromPrefix(prefix: string | null): FormatState['line'] {
  if (!prefix) return null
  for (const style of LINE_STYLES) {
    if (style.prefixes.includes(prefix)) return style.action
  }
  return null
}

function prefixForLineStyle(action: 'list' | 'quote' | 'heading'): string {
  switch (action) {
    case 'heading':
      return '## '
    case 'quote':
      return '> '
    case 'list':
      return '- '
  }
}

export function getFormatState(view: EditorView): FormatState | null {
  const sel = view.state.selection.main
  if (sel.empty) return null

  const text = view.state.sliceDoc(sel.from, sel.to)
  const linkParsed = parseLink(text)
  const { marks } = linkParsed ? parseInlineMarks(linkParsed.plain) : parseInlineMarks(text)

  const doc = view.state.doc
  const fromLine = doc.lineAt(sel.from).number
  const toLine = doc.lineAt(sel.to).number

  let line: FormatState['line'] = null
  let lineKnown = true

  for (let n = fromLine; n <= toLine; n++) {
    const lineText = doc.sliceString(doc.line(n).from, doc.line(n).to)
    const { prefix } = stripLinePrefix(lineText)
    const style = lineStyleFromPrefix(prefix)
    if (n === fromLine) line = style
    else if (line !== style) lineKnown = false
  }

  return {
    inline: marks,
    link: linkParsed != null,
    line: lineKnown ? line : null,
  }
}

function toggleInlineMark(marks: InlineMarks, mark: InlineMark): InlineMarks {
  const next = { ...marks }
  if (mark === 'code') {
    if (next.code) {
      next.code = false
      return next
    }
    return { bold: false, italic: false, strike: false, code: true }
  }
  if (next.code) next.code = false
  next[mark] = !next[mark]
  return next
}

function applyInlineFormat(view: EditorView, mark: InlineMark): boolean {
  const { from, to } = view.state.selection.main

  if (from === to) {
    const m = INLINE_MARKER[mark]
    view.dispatch({
      changes: { from, insert: m + m },
      selection: { anchor: from + m.length },
    })
    view.focus()
    return true
  }

  const raw = view.state.sliceDoc(from, to)
  const linkParsed = parseLink(raw)
  const { plain, marks } = linkParsed
    ? parseInlineMarks(linkParsed.plain)
    : parseInlineMarks(raw)

  const next = toggleInlineMark(marks, mark)
  const label = buildInline(plain, next)
  const insert = linkParsed ? `[${label}](${linkParsed.url})` : label

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from, head: from + insert.length },
  })
  view.focus()
  return true
}

function applyLineFormat(view: EditorView, action: 'list' | 'quote' | 'heading'): boolean {
  const sel = view.state.selection.main
  const doc = view.state.doc
  const fromLine = doc.lineAt(sel.from).number
  const toLine = doc.lineAt(sel.to).number
  const targetPrefix = prefixForLineStyle(action)

  const lineInfos: { line: number; body: string; had: FormatState['line'] }[] = []
  for (let n = fromLine; n <= toLine; n++) {
    const line = doc.line(n)
    const text = doc.sliceString(line.from, line.to)
    const { body, prefix } = stripLinePrefix(text)
    lineInfos.push({ line: n, body, had: lineStyleFromPrefix(prefix) })
  }

  const allTarget = lineInfos.every((l) => l.had === action)
  const changes: ChangeSpec[] = []

  for (const info of lineInfos) {
    const line = doc.line(info.line)
    const text = doc.sliceString(line.from, line.to)
    if (allTarget) {
      const { body } = stripLinePrefix(text)
      changes.push({ from: line.from, to: line.to, insert: body })
    } else {
      const { body } = stripLinePrefix(text)
      changes.push({ from: line.from, to: line.to, insert: `${targetPrefix}${body}` })
    }
  }

  if (!changes.length) return false
  view.dispatch({ changes })
  view.focus()
  return true
}

/** Existing link URL covering `[from, to)`, or null when the range isn't a link. */
export function linkUrlInRange(view: EditorView, from: number, to: number): string | null {
  const existing = parseLink(view.state.sliceDoc(from, to))
  return existing ? existing.url : null
}

/**
 * Wrap `[from, to)` as a link to `url`, preserving any inline marks on the label.
 * Re-linking an existing link swaps the URL rather than nesting. Replaces the
 * old `window.prompt` flow, which renders an ugly native dialog (and is blocked
 * outright in some desktop webviews).
 */
export function setLink(view: EditorView, from: number, to: number, url: string): void {
  const trimmed = url.trim()
  if (!trimmed) return
  const raw = view.state.sliceDoc(from, to)
  const existing = parseLink(raw)
  const label = (existing ? existing.plain : raw) || 'link'
  const insert = `[${label}](${trimmed})`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from, head: from + insert.length },
  })
  view.focus()
}

/** Unwrap a link in `[from, to)`, keeping the visible label text. */
export function clearLink(view: EditorView, from: number, to: number): void {
  const existing = parseLink(view.state.sliceDoc(from, to))
  if (!existing) {
    view.focus()
    return
  }
  view.dispatch({
    changes: { from, to, insert: existing.plain },
    selection: { anchor: from, head: from + existing.plain.length },
  })
  view.focus()
}

export function applyFormat(view: EditorView, action: FormatAction): boolean {
  switch (action) {
    case 'bold':
      return applyInlineFormat(view, 'bold')
    case 'italic':
      return applyInlineFormat(view, 'italic')
    case 'strike':
      return applyInlineFormat(view, 'strike')
    case 'code':
      return applyInlineFormat(view, 'code')
    case 'link':
      // Links are captured through the link popover (see Editor), not a synchronous
      // text edit — the format bar / ⌘K route to onRequestLink instead.
      return false
    case 'list':
      return applyLineFormat(view, 'list')
    case 'quote':
      return applyLineFormat(view, 'quote')
    case 'heading':
      return applyLineFormat(view, 'heading')
    default:
      return false
  }
}

export function isFormatActive(state: FormatState, action: FormatAction): boolean {
  switch (action) {
    case 'bold':
      return state.inline.bold
    case 'italic':
      return state.inline.italic
    case 'strike':
      return state.inline.strike
    case 'code':
      return state.inline.code
    case 'link':
      return state.link
    case 'list':
      return state.line === 'list'
    case 'quote':
      return state.line === 'quote'
    case 'heading':
      return state.line === 'heading'
    default:
      return false
  }
}

/** Bounding box for the current selection in viewport coordinates. */
export function selectionAnchorRect(view: EditorView): DOMRect | null {
  const sel = view.state.selection.main
  if (sel.empty) return null

  const start = view.coordsAtPos(sel.from, -1)
  const end = view.coordsAtPos(sel.to, 1)
  if (!start || !end) return null

  const left = Math.min(start.left, end.left)
  const right = Math.max(start.right, end.right)
  const top = Math.min(start.top, end.top)
  const bottom = Math.max(start.bottom, end.bottom)
  return new DOMRect(left, top, right - left, bottom - top)
}
