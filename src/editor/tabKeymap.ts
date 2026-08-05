import { indentLess, indentWithTab, insertNewline } from '@codemirror/commands'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

/**
 * CodeMirror's standard Tab / Shift-Tab indent — works for lists, checkboxes,
 * and indented prose without custom parsing or navigation side effects.
 *
 * Enter continues markdown list/quote markup first (so `1.` → `2.`, `-` → `-`,
 * and an empty item ends the list), then falls back to a plain newline with no
 * auto-indent — prose paragraphs still start at column zero.
 * insertNewlineContinueMarkup returns false outside a list/quote, so prose hits
 * the fallback. Task-list Enter handling (taskListExtension) sits at
 * Prec.highest, above this Prec.high, so it still fires first for checklist
 * lines.
 */
function continueListOrNewline(view: EditorView): boolean {
  return insertNewlineContinueMarkup(view) || insertNewline(view)
}

export const editorTabKeymap = Prec.high(
  keymap.of([
    indentWithTab,
    { key: 'Shift-Tab', run: indentLess },
    { key: 'Enter', run: continueListOrNewline },
  ]),
)
