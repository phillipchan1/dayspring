import type { EditorState, Text } from '@codemirror/state'
import type { ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import { spiritualBlocksField } from './spiritualBlocksField'

/**
 * Where the borrowed words actually are inside a scripture fence.
 *
 * A scripture block serializes as four kinds of line — the opening fence, the
 * verse (one line or several), the citation, and the closing fence — and the
 * three things that now read this file each care about a different subset:
 * the decoration draws each kind differently, the read-only filter defends the
 * whole fence, and marking is allowed on the verse and nowhere else. Deriving
 * all of that in one place is what keeps them from disagreeing about which line
 * the citation is.
 *
 * `reference` is the parser's own answer to whether a citation line exists
 * (`parseScriptureBody` only claims one when the body has more than one line),
 * so this never has to re-guess it from the text.
 */
export interface ScriptureLines {
  /** Line number of the opening ``` fence. */
  openLine: number
  /** Line number of the closing ``` fence. */
  closeLine: number
  /** First and last line of the verse itself. */
  verseFirst: number
  verseLast: number
  /** The citation line, when the block carries one. */
  citeLine: number | null
}

function clamp(pos: number, doc: Text): number {
  return Math.max(0, Math.min(pos, doc.length))
}

/**
 * Resolve a parsed block's line geometry. Null when the fence has no body at
 * all — `parseSpiritualBlocks` only emits a block once it has found a closing
 * fence, so in practice this is the degenerate ```` ```x\n``` ```` shape.
 */
export function scriptureLines(doc: Text, block: ParsedSpiritualBlock): ScriptureLines | null {
  const open = doc.lineAt(clamp(block.from, doc))
  // `block.to` sits past the closing fence, and past its newline when the block
  // isn't the last thing in the document.
  const end =
    block.to > block.from && doc.sliceString(block.to - 1, block.to) === '\n' ? block.to - 1 : block.to
  const close = doc.lineAt(clamp(end, doc))
  const first = open.number + 1
  const last = close.number - 1
  if (last < first) return null

  // A citation only exists when the parser claimed one, and it is always the
  // final body line. `parseScriptureBody` never claims a reference from a
  // single-line body, so `last > first` is belt-and-braces rather than a
  // second opinion. Without a citation, every body line is verse.
  const hasCite = block.reference != null && last > first
  return {
    openLine: open.number,
    closeLine: close.number,
    verseFirst: first,
    verseLast: hasCite ? last - 1 : last,
    citeLine: hasCite ? last : null,
  }
}

/** Character range of the verse lines — what a mark is allowed to cover. */
export function verseRange(doc: Text, block: ParsedSpiritualBlock): { from: number; to: number } | null {
  const lines = scriptureLines(doc, block)
  if (!lines) return null
  return { from: doc.line(lines.verseFirst).from, to: doc.line(lines.verseLast).to }
}

/**
 * The verse range containing `from`–`to`, or null when the selection is
 * anywhere else — prose, a citation line, a prayer, a fence delimiter.
 *
 * Both ends must land in the same verse, so a selection dragged out of the
 * block and into the paragraph below is prose again and gets the ordinary bar.
 */
export function scriptureVerseAt(
  state: EditorState,
  from: number,
  to: number,
): { block: ParsedSpiritualBlock; from: number; to: number } | null {
  for (const block of state.field(spiritualBlocksField)) {
    if (block.type !== 'scripture') continue
    const range = verseRange(state.doc, block)
    if (!range) continue
    if (from >= range.from && to <= range.to) return { block, from: range.from, to: range.to }
  }
  return null
}

/**
 * Grow a selection out to whole words, then back off any whitespace.
 *
 * A mark reading "raw near to Go" is noise on the Pages wall forever, and
 * unlike prose — where the writer can re-select and fix it — the words here
 * can't be edited into shape afterwards. Bounded by `limit` so snapping can
 * never walk off the verse and onto a fence delimiter.
 */
export function snapToWords(
  doc: Text,
  from: number,
  to: number,
  limit: { from: number; to: number },
): { from: number; to: number } {
  const text = doc.sliceString(limit.from, limit.to)
  let s = Math.max(0, from - limit.from)
  let e = Math.min(text.length, to - limit.from)

  // Only grow when the edge actually cuts a word in half. A selection that
  // starts on the space after "Draw" is not a partial "Draw" — expanding it
  // unconditionally swallowed the preceding word, which reads as the gesture
  // ignoring you.
  if (s < text.length && /\S/.test(text.charAt(s))) {
    while (s > 0 && /\S/.test(text.charAt(s - 1))) s--
  }
  if (e > 0 && /\S/.test(text.charAt(e - 1))) {
    while (e < text.length && /\S/.test(text.charAt(e))) e++
  }
  while (s < e && /\s/.test(text.charAt(s))) s++
  while (e > s && /\s/.test(text.charAt(e - 1))) e--

  return { from: limit.from + s, to: limit.from + e }
}
