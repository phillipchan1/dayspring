import { syntaxTree } from '@codemirror/language'
import type { ChangeSpec, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { NAMED_COLOR_PATTERN, type HighlightColor } from '@/lib/highlightColors'

export type { HighlightColor }

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'link'
  | 'list'
  | 'quote'
  | 'heading'

/**
 * Highlight is deliberately NOT an InlineMark: it carries a colour, and its
 * toggle semantics differ (same colour turns it off, a different colour swaps).
 * See `toggleHighlight`.
 */
export type InlineMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code'

export interface InlineMarks {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  /** null when unhighlighted. 'amber' is the colour a bare `==` means. */
  highlight: HighlightColor | null
}

export interface FormatState {
  inline: InlineMarks
  link: boolean
  /** Line-level style when every touched line agrees; otherwise null. */
  line: 'list' | 'quote' | 'heading' | null
}

/**
 * Exported so callers (and tests) spread it instead of writing object literals
 * that break every time a mark is added — which is exactly what happened when
 * underline and highlight landed.
 */
export const EMPTY_INLINE: InlineMarks = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  highlight: null,
}

const INLINE_MARKER: Record<InlineMark, string> = {
  bold: '**',
  italic: '*',
  underline: '++',
  strike: '~~',
  code: '`',
}

const LINE_STYLES: { action: 'list' | 'quote' | 'heading'; prefixes: string[] }[] = [
  { action: 'heading', prefixes: ['### ', '## ', '# '] },
  { action: 'quote', prefixes: ['> '] },
  { action: 'list', prefixes: ['- ', '* '] },
]

/**
 * True when `t` is a single span wrapped by `marker`. Stacked identical
 * wrappers (`****word****`) count as one span; several sibling spans that
 * merely share an outer delimiter (`**a** and **b**`) do not — peeling those
 * would corrupt the document on re-wrap.
 */
function isSingleSpanWrapped(t: string, marker: string): boolean {
  const k = marker.length
  if (t.length < k * 2) return false
  if (!t.startsWith(marker) || !t.endsWith(marker)) return false
  const inner = t.slice(k, -k)
  if (!inner.includes(marker)) return true
  return isSingleSpanWrapped(inner, marker)
}

const HL_RE = new RegExp(`^==(?:\\{(${NAMED_COLOR_PATTERN})\\})?([\\s\\S]*)==$`)
const HL_OPEN_AT_END = new RegExp(`==(?:\\{(?:${NAMED_COLOR_PATTERN})\\})?$`)

/**
 * `isSingleSpanWrapped` can't judge a highlight: the opening marker may carry
 * a colour (`=={rose}`) while the closing one never does. This keeps the same
 * single-span guard — `==a== and ==b==` must NOT peel, or re-wrapping it
 * strands delimiters in the document.
 */
function peelHighlight(text: string): { inner: string; color: HighlightColor } | null {
  const m = HL_RE.exec(text)
  if (!m) return null
  const inner = m[2] ?? ''
  if (inner.includes('==')) return null
  return { inner, color: (m[1] as HighlightColor | undefined) ?? 'amber' }
}

/**
 * Peel a matching `*` / `_` run from both ends as one emphasis span.
 *
 * Counting the run (instead of trying `***` then `**` then `*`) is what
 * recovers from stacked bold: `****word****` is two bold pairs, not a
 * `***` wrap around a leftover `*`. Marker soup with no inner text
 * (`****`, `***`) is read as empty bold / bold+italic so a second press
 * can take the pair off instead of adding another.
 */
function peelDelimRun(
  t: string,
  ch: '*' | '_',
): { inner: string; bold: boolean; italic: boolean } | null {
  if (!t.startsWith(ch) || !t.endsWith(ch) || t.length < 2) return null

  let n = 0
  while (n < t.length && t[n] === ch && t[t.length - 1 - n] === ch) n++

  if (n * 2 >= t.length) {
    if (![...t].every((c) => c === ch)) return null
    return { inner: '', bold: t.length >= 2, italic: t.length % 2 === 1 }
  }

  const inner = t.slice(n, t.length - n)
  const pair = ch + ch
  if (inner.includes(pair) || (n === 1 && inner.includes(ch))) {
    if (!peelDelimRun(inner, ch)) return null
  }

  return { inner, bold: n >= 2, italic: n % 2 === 1 }
}

/** Peel recognized markdown wrappers until the plain phrase is exposed. */
export function parseInlineMarks(text: string): { plain: string; marks: InlineMarks } {
  let t = text
  const marks: InlineMarks = { ...EMPTY_INLINE }

  // Order mirrors buildInline, outermost wrapper first.
  for (let guard = 0; guard < 16; guard++) {
    if (isSingleSpanWrapped(t, '`')) {
      marks.code = true
      t = t.slice(1, -1)
      continue
    }
    const hl = peelHighlight(t)
    if (hl) {
      marks.highlight = hl.color
      t = hl.inner
      continue
    }
    if (isSingleSpanWrapped(t, '++')) {
      marks.underline = true
      t = t.slice(2, -2)
      continue
    }
    const em = peelDelimRun(t, '*') ?? peelDelimRun(t, '_')
    if (em) {
      if (em.bold) marks.bold = true
      if (em.italic) marks.italic = true
      t = em.inner
      continue
    }
    if (isSingleSpanWrapped(t, '~~')) {
      marks.strike = true
      t = t.slice(2, -2)
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

/** The delimiters a highlight of `color` opens and closes with. */
export function highlightMarkers(color: HighlightColor): { open: string; close: string } {
  return { open: color === 'amber' ? '==' : `=={${color}}`, close: '==' }
}

/**
 * Rebuild inline markdown from plain text + marks (stable, non-nested marker soup).
 * Nesting runs outermost → innermost: highlight, underline, bold/italic, strike.
 * Highlight sits outermost because it marks a *region* — `==**x**==` reads better
 * than `**==x==**`, and it matches how the parser resolves the delimiters.
 */
export function buildInline(plain: string, marks: InlineMarks): string {
  // Markers must hug the words. `**text **` is not bold in CommonMark (a
  // closer can't follow a space), so any edge whitespace — a phone's
  // double-tap grabs the trailing space, a line selection grabs its end —
  // goes OUTSIDE the pair: `**text** `. Whitespace-only text stays as is.
  const ws = /^(\s*)([\s\S]*?)(\s*)$/.exec(plain)
  if (ws && ws[2] && (ws[1] || ws[3])) {
    return `${ws[1]}${buildInline(ws[2], marks)}${ws[3]}`
  }
  if (marks.code) return `\`${plain}\``

  let s = plain
  if (marks.strike) s = `~~${s}~~`
  if (marks.bold && marks.italic) s = `***${s}***`
  else if (marks.bold) s = `**${s}**`
  else if (marks.italic) s = `*${s}*`
  if (marks.underline) s = `++${s}++`
  if (marks.highlight) {
    const { open, close } = highlightMarkers(marks.highlight)
    s = `${open}${s}${close}`
  }
  return s
}

/** Length of the opening wrappers `buildInline` emits — caret sits after them. */
function openingMarkerLength(marks: InlineMarks): number {
  if (marks.code) return 1
  let n = 0
  if (marks.highlight) n += highlightMarkers(marks.highlight).open.length
  if (marks.underline) n += 2
  if (marks.bold && marks.italic) n += 3
  else if (marks.bold) n += 2
  else if (marks.italic) n += 1
  if (marks.strike) n += 2
  return n
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[\p{L}\p{N}'’\-]/u.test(ch)
}

function isMarkerPunct(ch: string | undefined): boolean {
  return ch === '*' || ch === '_' || ch === '+' || ch === '~' || ch === '=' || ch === '`'
}

/** The word touching `pos`, or null when the caret sits in whitespace. */
export function wordRangeAt(state: EditorState, pos: number): { from: number; to: number } | null {
  const line = state.doc.lineAt(pos)
  const text = line.text
  const offset = Math.max(0, Math.min(pos - line.from, text.length))

  let start = offset
  let end = offset
  if (start > 0 && (start === text.length || !isWordChar(text[start])) && isWordChar(text[start - 1])) {
    start--
  }
  while (start > 0 && isWordChar(text[start - 1])) start--
  while (end < text.length && isWordChar(text[end])) end++
  if (start === end) return null
  return { from: line.from + start, to: line.from + end }
}

/**
 * If `[from, to)` is immediately wrapped by a recognised pair, return the
 * range that includes those markers. Longer markers win so `***` is not
 * stolen as a `*` plus a leftover `**`.
 */
function tryConsumeWrapper(doc: string, from: number, to: number): { from: number; to: number } | null {
  const left = doc.slice(Math.max(0, from - 16), from)
  const right = doc.slice(to, to + 24)

  const hl = HL_OPEN_AT_END.exec(left)
  if (hl && right.startsWith('==')) {
    return { from: from - hl[0].length, to: to + 2 }
  }

  if (from > 0 && doc[from - 1] === '[') {
    const link = /^\]\([^)]+\)/.exec(doc.slice(to))
    if (link) return { from: from - 1, to: to + link[0].length }
  }

  for (const p of ['***', '**', '__', '++', '~~', '*', '_', '`'] as const) {
    if (!left.endsWith(p) || !right.startsWith(p)) continue
    if (p === '*' && (left.endsWith('**') || right.startsWith('**'))) continue
    if (p === '_' && (left.endsWith('__') || right.startsWith('__'))) continue
    return { from: from - p.length, to: to + p.length }
  }
  return null
}

/** Widen `[from, to)` across stacked wrappers without needing a syntax tree. */
export function expandTextualWrappers(
  doc: string,
  from: number,
  to: number,
): { from: number; to: number } {
  let f = from
  let t = to
  for (let i = 0; i < 16; i++) {
    const next = tryConsumeWrapper(doc, f, t)
    if (!next) break
    f = next.from
    t = next.to
  }
  return { from: f, to: t }
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

/** Inline nodes whose markers wrap a phrase. Order-independent; membership only. */
const SPAN_NODES = new Set([
  'Emphasis',
  'StrongEmphasis',
  'Strikethrough',
  'InlineCode',
  'Highlight',
  'Underline',
  'Link',
])

/**
 * The visible range inside a span's markers, or null when the node isn't the
 * marker-wrapped shape we expect.
 *
 * A Link is the odd one out: its markers are `[ ] ( )`, so the visible part is
 * the label between the FIRST two LinkMarks, not between the outermost pair.
 * Without that case, selecting a concealed link's label and hitting ⌘K would
 * nest a second link inside the first.
 */
function spanContentRange(node: SyntaxNodeLike): { from: number; to: number } | null {
  if (node.name === 'Link') {
    const open = node.firstChild
    if (!open || open.name !== 'LinkMark') return null
    const close = open.nextSibling?.name === 'LinkMark' ? open.nextSibling : findNextMark(open)
    if (!close) return null
    return { from: open.to, to: close.from }
  }
  const first = node.firstChild
  const last = node.lastChild
  if (!first || !last || first === last) return null
  if (!first.name.endsWith('Mark') || !last.name.endsWith('Mark')) return null
  return { from: first.to, to: last.from }
}

interface SyntaxNodeLike {
  name: string
  from: number
  to: number
  firstChild: SyntaxNodeLike | null
  lastChild: SyntaxNodeLike | null
  nextSibling: SyntaxNodeLike | null
  parent: SyntaxNodeLike | null
}

/** The next `LinkMark` sibling — the `]` that closes a link label. */
function findNextMark(node: SyntaxNodeLike): SyntaxNodeLike | null {
  let n = node.nextSibling
  while (n) {
    if (n.name === 'LinkMark') return n
    n = n.nextSibling
  }
  return null
}

/**
 * Widen `[from, to)` to any inline span whose *content* it exactly covers, so
 * formatting acts on the whole `*word*` even when the markers are concealed and
 * the writer could only select `word`.
 *
 * Without this, toggling italic on a concealed italic span nests a second pair
 * and silently turns it bold — a latent bug that concealment makes routine. The
 * match must be exact (content === selection): a partial selection inside a span
 * is left alone, and selecting `b` inside `**a *b* c**` expands to `*b*` only,
 * never to the whole bold run.
 */
export function expandToInlineSpans(
  state: EditorState,
  from: number,
  to: number,
): { from: number; to: number } {
  if (from === to) return { from, to }
  let f = from
  let t = to
  let node: SyntaxNodeLike | null = syntaxTree(state).resolveInner(f, 1) as SyntaxNodeLike
  // Climb: each enclosing span whose content is exactly the current range
  // swallows its markers, and the next one out is re-tested against that.
  while (node) {
    if (SPAN_NODES.has(node.name)) {
      const content = spanContentRange(node)
      if (content && content.from === f && content.to === t) {
        f = node.from
        t = node.to
      }
    }
    node = node.parent
  }
  // Textual fallback: concealment, a lagged parse, or a test without the
  // markdown language still have to see `**word**` when the writer selected
  // `word`. Without this, each press wraps again (`****word****`, then six).
  return expandTextualWrappers(state.doc.toString(), f, t)
}

function delimRunAt(doc: string, pos: number, ch: string): number {
  let left = 0
  while (pos - left - 1 >= 0 && doc[pos - left - 1] === ch) left++
  let right = 0
  while (pos + right < doc.length && doc[pos + right] === ch) right++
  return Math.min(left, right)
}

/**
 * Empty marker soup at the caret (`*|` `*`, `**|**`, `==|==`). Asterisk runs
 * are counted from the caret, not parsed as a blob — `**` with the caret in
 * the middle is empty italic, not empty bold. Rejects a caret sitting inside
 * a stacked opener (`**|**word****`) so we don't strip the opening of a real
 * span and leave `word****` behind.
 */
function emptyMarksAt(
  doc: string,
  pos: number,
): { from: number; to: number; marks: InlineMarks } | null {
  const marks: InlineMarks = { ...EMPTY_INLINE }
  let from = pos
  let to = pos

  const stars = delimRunAt(doc, pos, '*')
  const unders = stars === 0 ? delimRunAt(doc, pos, '_') : 0
  const run = stars || unders
  if (run > 0) {
    if (run >= 2) marks.bold = true
    if (run % 2 === 1) marks.italic = true
    from = pos - run
    to = pos + run
  }

  for (let i = 0; i < 8; i++) {
    const left = doc.slice(Math.max(0, from - 16), from)
    const right = doc.slice(to, to + 16)
    const hl = HL_OPEN_AT_END.exec(left)
    if (hl && right.startsWith('==')) {
      const spec = hl[0].match(new RegExp(`\\{(${NAMED_COLOR_PATTERN})\\}$`))
      marks.highlight = (spec?.[1] as HighlightColor | undefined) ?? 'amber'
      from -= hl[0].length
      to += 2
      continue
    }
    if (left.endsWith('++') && right.startsWith('++')) {
      marks.underline = true
      from -= 2
      to += 2
      continue
    }
    if (left.endsWith('~~') && right.startsWith('~~')) {
      marks.strike = true
      from -= 2
      to += 2
      continue
    }
    if (left.endsWith('`') && right.startsWith('`')) {
      marks.code = true
      from -= 1
      to += 1
      continue
    }
    break
  }

  if (from === to) return null
  if (isWordChar(doc[from - 1]) || isWordChar(doc[to])) return null
  return { from, to, marks }
}

/** Outermost formatted span that contains `pos`, or a word already wrapped. */
function enclosingFormatRange(
  state: EditorState,
  pos: number,
): { from: number; to: number } | null {
  let best: { from: number; to: number } | null = null
  for (const side of [-1, 1, 0] as const) {
    let node: SyntaxNodeLike | null = syntaxTree(state).resolveInner(pos, side) as SyntaxNodeLike
    while (node) {
      if (SPAN_NODES.has(node.name) && node.from <= pos && pos <= node.to) {
        if (!best || (node.from <= best.from && node.to >= best.to)) {
          best = { from: node.from, to: node.to }
        }
      }
      node = node.parent
    }
  }
  if (best) return best

  const pair = textualPairAround(state, pos)
  if (pair) return pair

  const doc = state.doc.toString()
  const word = wordRangeAt(state, pos)
  if (word) {
    const exp = expandTextualWrappers(doc, word.from, word.to)
    if (exp.from !== word.from || exp.to !== word.to) return exp
  }

  // Caret in a marker run next to a formatted word (`**|**hello****`).
  const snapped = adjacentWrappedWord(doc, pos)
  if (snapped) return snapped
  return null
}

/**
 * A same-line `**…**` / `~~…~~` / `==…==` / `++…++` pair around `pos` that the
 * parser did NOT read as a span — almost always edge whitespace inside it
 * (`**text **`). Finding it lets a press repair the whole span rather than
 * wrapping one word inside it and making the soup worse.
 */
function textualPairAround(state: EditorState, pos: number): { from: number; to: number } | null {
  const line = state.doc.lineAt(pos)
  const text = line.text
  const at = pos - line.from
  for (const ch of ['*', '~', '=', '+']) {
    const runs: { from: number; to: number }[] = []
    for (let i = 0; i < text.length; ) {
      if (text[i] !== ch) {
        i++
        continue
      }
      let j = i
      while (j < text.length && text[j] === ch) j++
      if (j - i === 2) runs.push({ from: i, to: j })
      i = j
    }
    for (let k = 0; k + 1 < runs.length; k += 2) {
      const open = runs[k]!
      const close = runs[k + 1]!
      if (open.from <= at && at <= close.to && text.slice(open.to, close.from).trim()) {
        return { from: line.from + open.from, to: line.from + close.to }
      }
    }
  }
  return null
}

function adjacentWrappedWord(doc: string, pos: number): { from: number; to: number } | null {
  const tryAt = (at: number): { from: number; to: number } | null => {
    if (at < 0 || at >= doc.length || !isWordChar(doc[at])) return null
    let start = at
    let end = at + 1
    while (start > 0 && isWordChar(doc[start - 1])) start--
    while (end < doc.length && isWordChar(doc[end])) end++
    const exp = expandTextualWrappers(doc, start, end)
    if (exp.from === start && exp.to === end) return null
    if (exp.from <= pos && pos <= exp.to) return exp
    return null
  }

  let i = pos
  while (i < doc.length && isMarkerPunct(doc[i])) i++
  const right = tryAt(i)
  if (right) return right

  let j = pos
  while (j > 0 && isMarkerPunct(doc[j - 1])) j--
  return tryAt(j - 1)
}

/**
 * The range a format would act on: a live selection (widened to its inline
 * span), or at an empty caret the empty marker pair / enclosing span / word
 * the caret is in. Collapses to the caret when none of those apply, so the
 * format bar can sit on a collapsed insertion point.
 */
export function formatTargetRange(view: EditorView): { from: number; to: number } {
  const sel = view.state.selection.main
  if (!sel.empty) return expandToInlineSpans(view.state, sel.from, sel.to)

  const pos = sel.from
  const doc = view.state.doc.toString()
  const empty = emptyMarksAt(doc, pos)
  if (empty) return { from: empty.from, to: empty.to }
  const enclosing = enclosingFormatRange(view.state, pos)
  if (enclosing) return enclosing
  const word = wordRangeAt(view.state, pos)
  if (word) return word
  return { from: pos, to: pos }
}

export function getFormatState(view: EditorView): FormatState {
  const sel = view.state.selection.main
  const span = formatTargetRange(view)
  const text = view.state.sliceDoc(span.from, span.to)
  const linkParsed = span.from === span.to ? null : parseLink(text)

  // Report what the writer SEES, read the same way a press will write: per
  // line for a selection, and a broken span (`**text **`) as unmarked.
  let marks: InlineMarks
  const ranges = sel.empty
    ? span.from === span.to || emptyMarksAt(view.state.doc.toString(), sel.from)
      ? null
      : [span]
    : selectionSegments(view.state, sel.from, sel.to)
  if (ranges && ranges.length) {
    marks = commonMarks(ranges.map((r) => readSegment(view.state, r.from, r.to)))
  } else {
    marks = (linkParsed ? parseInlineMarks(linkParsed.plain) : parseInlineMarks(text)).marks
  }

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

export function toggleInlineMark(marks: InlineMarks, mark: InlineMark): InlineMarks {
  const next = { ...marks }
  if (mark === 'code') {
    if (next.code) {
      next.code = false
      return next
    }
    return { ...EMPTY_INLINE, code: true }
  }
  if (next.code) next.code = false
  next[mark] = !next[mark]
  return next
}

/** Same colour turns the highlight off; a different colour swaps it. */
export function toggleHighlight(marks: InlineMarks, color: HighlightColor): InlineMarks {
  return { ...marks, code: false, highlight: marks.highlight === color ? null : color }
}

/**
 * The block syntax a line opens with — indentation, quote `>`s, a heading's
 * `#`s, a bullet / number, a task box. Inline marks must start AFTER it: a
 * bold that swallows `- ` turns the bullet into literal text (`**- item**`),
 * which is exactly how selecting a whole list line and pressing B used to
 * break both the list and the bold.
 */
const LINE_PREFIX_RE =
  /^[ \t]*(?:(?:>[ \t]?)+[ \t]*)?(?:#{1,6}[ \t]+|(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?/

export function linePrefixLength(text: string): number {
  return LINE_PREFIX_RE.exec(text)?.[0].length ?? 0
}

function hasAnyMark(marks: InlineMarks): boolean {
  return (
    marks.bold || marks.italic || marks.underline || marks.strike || marks.code || marks.highlight !== null
  )
}

/**
 * The ranges a non-empty selection formats: one per line, each starting after
 * the line's block prefix and trimmed of edge whitespace, then widened to any
 * span it exactly covers. Inline marks can't cross list items or paragraphs,
 * so a multi-line selection is formatted line by line — never one pair whose
 * closer lands on another line and renders as nothing.
 */
export function selectionSegments(
  state: EditorState,
  from: number,
  to: number,
): { from: number; to: number }[] {
  const doc = state.doc
  const out: { from: number; to: number }[] = []
  const first = doc.lineAt(from).number
  const last = doc.lineAt(to).number
  for (let n = first; n <= last; n++) {
    const line = doc.line(n)
    let a = Math.max(from, line.from + linePrefixLength(line.text))
    let b = Math.min(to, line.to)
    while (a < b && /\s/.test(doc.sliceString(a, a + 1))) a++
    while (b > a && /\s/.test(doc.sliceString(b - 1, b))) b--
    if (a < b) out.push(expandToInlineSpans(state, a, b))
  }
  return out
}

interface SegmentRead {
  from: number
  to: number
  url: string | null
  /** Block prefix a mark wrongly swallowed (`**- item**`), to set back outside. */
  prefix: string
  lead: string
  trail: string
  core: string
  marks: InlineMarks
  /**
   * Marked in the text but not rendering: edge whitespace inside the pair
   * (`**text **`) or a swallowed bullet. Such a span LOOKS plain, so pressing
   * the mark repairs it instead of toggling it off.
   */
  broken: boolean
}

function readSegment(state: EditorState, from: number, to: number): SegmentRead {
  const raw = state.sliceDoc(from, to)
  const link = parseLink(raw)
  const { plain, marks } = parseInlineMarks(link ? link.plain : raw)
  let body = plain
  let prefix = ''
  if (!link && hasAnyMark(marks) && from === state.doc.lineAt(from).from) {
    const n = linePrefixLength(body)
    if (n > 0 && body.slice(n).trim()) {
      prefix = body.slice(0, n)
      body = body.slice(n)
    }
  }
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(body)
  const lead = m?.[1] ?? ''
  const core = m?.[2] ?? body
  const trail = m?.[3] ?? ''
  const broken = hasAnyMark(marks) && core !== '' && (prefix !== '' || lead !== '' || trail !== '')
  return { from, to, url: link?.url ?? null, prefix, lead, trail, core, marks, broken }
}

/** The marks a writer actually SEES on a segment — a broken span shows none. */
function visibleMarks(seg: SegmentRead): InlineMarks {
  return seg.broken ? { ...EMPTY_INLINE } : seg.marks
}

/** Marks every segment shares: a mark is on only when it is on everywhere. */
function commonMarks(segs: SegmentRead[]): InlineMarks {
  const all = segs.map(visibleMarks)
  const first = all[0] ?? EMPTY_INLINE
  return {
    bold: all.every((m) => m.bold),
    italic: all.every((m) => m.italic),
    underline: all.every((m) => m.underline),
    strike: all.every((m) => m.strike),
    code: all.every((m) => m.code),
    highlight: all.every((m) => m.highlight === first.highlight) ? first.highlight : null,
  }
}

function writeSegment(seg: SegmentRead, marks: InlineMarks): { insert: string; start: number } {
  const label = buildInline(seg.core, marks)
  const body = seg.url ? `[${label}](${seg.url})` : label
  return { insert: `${seg.prefix}${seg.lead}${body}${seg.trail}`, start: seg.prefix.length + seg.lead.length }
}

/**
 * Format a live selection. A broken span (marked but not rendering) is
 * repaired in place; otherwise the mark toggles as one: on everywhere unless
 * every line already has it, then off everywhere.
 */
function applyToSegments(
  view: EditorView,
  ranges: { from: number; to: number }[],
  transform: (marks: InlineMarks) => InlineMarks,
): boolean {
  const state = view.state
  const segs = ranges.map((r) => readSegment(state, r.from, r.to))
  const repairing = segs.some((s) => s.broken)

  const shared = commonMarks(segs)
  const target = transform(shared)
  const keys = ['bold', 'italic', 'underline', 'strike', 'code', 'highlight'] as const

  const writes = segs.map((seg) => {
    if (repairing) return seg.broken ? writeSegment(seg, seg.marks) : null
    const next: InlineMarks = { ...seg.marks }
    for (const k of keys) {
      if (target[k] !== shared[k]) (next as unknown as Record<string, unknown>)[k] = target[k]
    }
    // Code excludes every other mark (see toggleInlineMark).
    if (target.code && !shared.code) Object.assign(next, { ...EMPTY_INLINE, code: true })
    else if (!target.code && keys.some((k) => k !== 'code' && target[k] !== shared[k])) next.code = false
    return writeSegment(seg, next)
  })

  const specs: ChangeSpec[] = []
  segs.forEach((seg, i) => {
    const w = writes[i]
    if (w) specs.push({ from: seg.from, to: seg.to, insert: w.insert })
  })
  if (!specs.length) {
    view.focus()
    return true
  }
  const changes = state.changes(specs)

  // Select what was formatted (not the whitespace or bullet set back outside),
  // so the bar stays put and a second press undoes the first.
  const firstSeg = segs[0]!
  const lastSeg = segs[segs.length - 1]!
  const firstWrite = writes[0]
  const lastWrite = writes[writes.length - 1]
  const anchor = changes.mapPos(firstSeg.from, -1) + (firstWrite ? firstWrite.start : 0)
  const lastEnd = changes.mapPos(lastSeg.to, 1)
  const head = lastEnd - (lastWrite ? lastSeg.trail.length : 0)

  view.dispatch({ changes, selection: { anchor, head: Math.max(anchor, head) } })
  view.focus()
  return true
}

/**
 * The one write path for inline marks: find the target range, peel, transform,
 * rebuild, dispatch. Everything (bar, keymap, slash palette, mobile toolbar)
 * routes through here so a mark is always a toggle — never a second wrap.
 *
 * A live selection is formatted line by line, inside each line's block prefix
 * and edge whitespace (see `selectionSegments`). Empty caret, in order: take
 * off an empty pair (`**|**`), toggle the enclosing span, wrap (or unwrap) the
 * word at the caret, or insert a fresh empty pair. A second press of the same
 * button always undoes the first.
 */
function applyInlineTransform(
  view: EditorView,
  transform: (marks: InlineMarks) => InlineMarks,
  emptyMarkers: { open: string; close: string },
): boolean {
  const sel = view.state.selection.main

  if (!sel.empty) {
    const ranges = selectionSegments(view.state, sel.from, sel.to)
    if (ranges.length) return applyToSegments(view, ranges, transform)
    // Only whitespace / a bullet selected: nothing to wrap, so open an empty
    // pair where the selection ends, as an empty caret would.
    const { open, close } = emptyMarkers
    view.dispatch({
      changes: { from: sel.to, insert: open + close },
      selection: { anchor: sel.to + open.length },
    })
    view.focus()
    return true
  }

  const empty = emptyMarksAt(view.state.doc.toString(), sel.from)
  const span = formatTargetRange(view)
  const from = span.from
  const to = span.to

  if (from === to) {
    const { open, close } = emptyMarkers
    view.dispatch({
      changes: { from, insert: open + close },
      selection: { anchor: from + open.length },
    })
    view.focus()
    return true
  }

  if (!empty) return applyToSegments(view, [{ from, to }], transform)

  const next = transform(empty.marks)
  const insert = buildInline('', next)
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + openingMarkerLength(next) },
  })
  view.focus()
  return true
}

function applyInlineFormat(view: EditorView, mark: InlineMark): boolean {
  const m = INLINE_MARKER[mark]
  return applyInlineTransform(view, (marks) => toggleInlineMark(marks, mark), {
    open: m,
    close: m,
  })
}

/** Apply, swap, or remove a highlight colour on the live selection. */
export function applyHighlight(view: EditorView, color: HighlightColor): boolean {
  return applyInlineTransform(
    view,
    (marks) => toggleHighlight(marks, color),
    highlightMarkers(color),
  )
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
    case 'underline':
      return applyInlineFormat(view, 'underline')
    case 'strike':
      return applyInlineFormat(view, 'strike')
    case 'highlight':
      // The keyboard and slash-palette default. Colours come from the swatch row.
      return applyHighlight(view, 'amber')
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
    case 'underline':
      return state.inline.underline
    case 'strike':
      return state.inline.strike
    case 'highlight':
      return state.inline.highlight !== null
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

/** Bounding box for the format target in viewport coordinates. */
export function selectionAnchorRect(view: EditorView): DOMRect | null {
  const span = formatTargetRange(view)
  const start = view.coordsAtPos(span.from, -1)
  const end = view.coordsAtPos(span.to, 1)
  if (!start || !end) return null

  const left = Math.min(start.left, end.left)
  const right = Math.max(start.right, end.right)
  const top = Math.min(start.top, end.top)
  const bottom = Math.max(start.bottom, end.bottom)
  return new DOMRect(left, top, Math.max(right - left, 0), bottom - top)
}
