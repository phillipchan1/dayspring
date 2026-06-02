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

const LINE_STYLES: { action: 'list' | 'quote' | 'heading'; prefixes: string[] }[] = [
  { action: 'heading', prefixes: ['### ', '## ', '# '] },
  { action: 'quote', prefixes: ['> '] },
  { action: 'list', prefixes: ['- ', '* '] },
]

/** Peel recognized markdown wrappers until the plain phrase is exposed. */
export function parseInlineMarks(text: string): { plain: string; marks: InlineMarks } {
  let t = text
  const marks: InlineMarks = { ...EMPTY_INLINE }

  for (let guard = 0; guard < 8; guard++) {
    if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) {
      marks.code = true
      t = t.slice(1, -1)
      continue
    }
    if (t.startsWith('***') && t.endsWith('***') && t.length >= 6) {
      marks.bold = true
      marks.italic = true
      t = t.slice(3, -3)
      continue
    }
    if (t.startsWith('**') && t.endsWith('**') && t.length >= 4) {
      marks.bold = true
      t = t.slice(2, -2)
      continue
    }
    if (t.startsWith('~~') && t.endsWith('~~') && t.length >= 4) {
      marks.strike = true
      t = t.slice(2, -2)
      continue
    }
    if (t.startsWith('*') && t.endsWith('*') && t.length >= 2) {
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
  if (from === to) return false

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

function applyLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const raw = view.state.sliceDoc(from, to)
  const existing = parseLink(raw)

  if (existing) {
    view.dispatch({
      changes: { from, to, insert: existing.plain },
      selection: { anchor: from, head: from + existing.plain.length },
    })
    view.focus()
    return true
  }

  const { plain } = parseInlineMarks(raw)
  const url = globalThis.prompt('Link URL', 'https://')
  if (url == null || !url.trim()) return false
  const insert = `[${plain || 'link'}](${url.trim()})`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from, head: from + insert.length },
  })
  view.focus()
  return true
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
      return applyLink(view)
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
