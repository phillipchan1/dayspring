import { indentLess, indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'

/**
 * CodeMirror's standard Tab / Shift-Tab indent — works for lists, checkboxes,
 * and indented prose without custom parsing or navigation side effects.
 */
export const editorTabKeymap = Prec.high(
  keymap.of([indentWithTab, { key: 'Shift-Tab', run: indentLess }]),
)
