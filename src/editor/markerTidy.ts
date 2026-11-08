import { EditorState, type Extension, type TransactionSpec } from '@codemirror/state'

/**
 * Typed-marker tidy: `**text **` → `**text** ` the moment the closer is typed.
 *
 * CommonMark won't close a span on a delimiter that follows a space, nor open
 * one that precedes a space. On a phone that's the common case, not the edge
 * one — iOS puts a space after `?` or a word before you switch to the symbol
 * keyboard, so a hand-typed `**How do we…? **` sat there as literal asterisks.
 *
 * When the second character of a closing `**` / `~~` / `==` / `++` is typed,
 * and the line holds an unmatched opener of the same marker, the whitespace
 * hugging the inside of the pair is moved outside it in the same transaction
 * (one undo step), with the caret left after it so typing carries on. Nothing
 * else is ever touched: only the span just closed, only edge whitespace.
 */

const MARKERS = new Set(['*', '~', '=', '+'])

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[\p{L}\p{N}]/u.test(ch)
}

/** Runs of exactly two `ch` in `text` before `end`, as [from, to) pairs. */
function doubleRuns(text: string, ch: string, end: number): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = []
  for (let i = 0; i < end; ) {
    if (text[i] !== ch) {
      i++
      continue
    }
    let j = i
    while (j < text.length && text[j] === ch) j++
    if (j - i === 2 && j <= end) runs.push({ from: i, to: j })
    i = j
  }
  return runs
}

/**
 * The tidy for `text` with the caret at `caret` (line-relative), as a
 * replacement of [from, caret), or null when nothing needs moving. Exported
 * for tests.
 */
export function tidyClosingMarker(
  text: string,
  caret: number,
): { from: number; to: number; insert: string } | null {
  const ch = text[caret - 1]
  if (!ch || !MARKERS.has(ch)) return null
  // The closer must be exactly two characters, and complete.
  if (text[caret - 2] !== ch || text[caret - 3] === ch || text[caret] === ch) return null
  const closeFrom = caret - 2

  const runs = doubleRuns(text, ch, closeFrom)
  if (runs.length % 2 === 0) return null // every earlier pair is already closed
  const open = runs[runs.length - 1]!
  // `C++ and C ++` is prose, not underline: an opener glued to a word isn't one.
  if (isWordChar(text[open.from - 1])) return null

  const inner = text.slice(open.to, closeFrom)
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)
  if (!m) return null
  const [, lead = '', core = '', trail = ''] = m
  if (!core || (!lead && !trail)) return null
  // Marker soup inside (`** ** **`) is not a phrase to tidy.
  if (core.includes(ch + ch)) return null

  const pair = ch + ch
  return { from: open.from, to: caret, insert: `${lead}${pair}${core}${pair}${trail}` }
}

export function markerTidy(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || !tr.isUserEvent('input.type') || tr.isUserEvent('input.type.compose')) {
      return tr
    }
    const sel = tr.selection?.main ?? tr.newSelection.main
    if (!sel.empty || tr.newSelection.ranges.length !== 1) return tr

    // Only a single typed insertion that ends at the caret and ends in a marker.
    let single = true
    let insertedEnd = -1
    let count = 0
    tr.changes.iterChanges((_fa, _ta, _fb, toB, inserted) => {
      count++
      insertedEnd = toB
      const s = inserted.toString()
      if (!s || !MARKERS.has(s[s.length - 1]!)) single = false
    })
    if (!single || count !== 1 || insertedEnd !== sel.head) return tr

    const line = tr.newDoc.lineAt(sel.head)
    const fix = tidyClosingMarker(line.text, sel.head - line.from)
    if (!fix) return tr

    const from = line.from + fix.from
    const spec: TransactionSpec = {
      changes: { from, to: line.from + fix.to, insert: fix.insert },
      selection: { anchor: from + fix.insert.length },
      sequential: true,
    }
    return [tr, spec]
  })
}
