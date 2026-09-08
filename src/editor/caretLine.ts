import type { EditorState } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'

/**
 * The line the main caret is on.
 *
 * Mark decorations that split this line (syntax highlight spans, scripture
 * underlines) make Safari / WKWebView drop as-you-type autocorrect. Scripture
 * underlines still skip the whole line; prose highlighting is finer — it only
 * leaves the word being typed unmarked, so `**bold**` can paint on the same
 * line the moment the mark is closed.
 */
export function caretLineRange(state: EditorState): { from: number; to: number } {
  const line = state.doc.lineAt(state.selection.main.head)
  return { from: line.from, to: line.to }
}

/** True when `[from, to)` touches the caret's line. */
export function overlapsCaretLine(state: EditorState, from: number, to: number): boolean {
  const line = caretLineRange(state)
  return from < line.to && to > line.from
}

/** The main caret moved to a different line. */
export function caretLineChanged(update: ViewUpdate): boolean {
  if (!update.selectionSet) return false
  const before = update.startState.doc.lineAt(update.startState.selection.main.head).number
  const after = update.state.doc.lineAt(update.state.selection.main.head).number
  return before !== after
}

/**
 * The whitespace-delimited word around the main caret, widened to cover a
 * non-empty selection.
 *
 * Sitting in whitespace (or on an empty line) is an empty range at the caret,
 * so finished marks on either side are free to paint.
 */
export function caretWordRange(state: EditorState): { from: number; to: number } {
  const sel = state.selection.main
  const word = wordAround(state, sel.head)
  if (sel.empty) return word
  return { from: Math.min(word.from, sel.from), to: Math.max(word.to, sel.to) }
}

/** True when `[from, to)` touches the word being typed. */
export function overlapsCaretWord(state: EditorState, from: number, to: number): boolean {
  const word = caretWordRange(state)
  return from < word.to && to > word.from
}

/** The main caret moved to a different typing-word. */
export function caretWordChanged(update: ViewUpdate): boolean {
  if (!update.selectionSet) return false
  const before = caretWordRange(update.startState)
  const after = caretWordRange(update.state)
  return before.from !== after.from || before.to !== after.to
}

function wordAround(state: EditorState, pos: number): { from: number; to: number } {
  const line = state.doc.lineAt(pos)
  const text = line.text
  const offset = Math.max(0, Math.min(pos - line.from, text.length))

  const ws = (i: number) => {
    if (i < 0 || i >= text.length) return true
    return /\s/.test(text[i]!)
  }

  // Before a word character, or at the end of a word (before space / EOL).
  if (!ws(offset) || (offset > 0 && !ws(offset - 1))) {
    let start = offset
    let end = offset
    while (start > 0 && !ws(start - 1)) start--
    while (end < text.length && !ws(end)) end++
    return { from: line.from + start, to: line.from + end }
  }
  return { from: pos, to: pos }
}
