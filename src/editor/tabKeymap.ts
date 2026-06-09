import { indentLess, indentWithTab, insertNewline } from '@codemirror/commands'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'

/**
 * CodeMirror's standard Tab / Shift-Tab indent — works for lists, checkboxes,
 * and indented prose without custom parsing or navigation side effects.
 *
 * Enter is overridden with insertNewline (no auto-indent) so new paragraphs
 * always start at column zero. Task-list Enter handling sits at Prec.highest
 * and therefore still fires first for checklist lines.
 */
export const editorTabKeymap = Prec.high(
  keymap.of([
    indentWithTab,
    { key: 'Shift-Tab', run: indentLess },
    { key: 'Enter', run: insertNewline },
  ]),
)
