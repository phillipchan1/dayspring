import type { EditorState } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'

/**
 * The line the main caret is on.
 *
 * Mark decorations on this line (syntax highlight spans, scripture
 * underlines) split the text into extra DOM nodes. Safari / WKWebView then
 * treat the edit as programmatic and drop as-you-type autocorrect. Callers
 * leave this line as a single text node while the writer is on it; finished
 * lines keep their styling.
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
