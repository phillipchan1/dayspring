import { indentLess, indentWithTab, insertNewline } from '@codemirror/commands'
import { insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown'
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
/*
 * `nonTightLists: false` is what makes "an empty item ends the list" true.
 * CodeMirror's default, on an empty item that is a tight list's second item
 * (every freshly nested bullet), was to push a blank line holding a lone space
 * above it and leave the caret where it was — so Enter-twice never left the
 * list, it just loosened it. Now it steps out one level: nested to parent,
 * top level out of the list, as in Notes, Notion and Bear.
 */
export const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false })

function continueListOrNewline(view: EditorView): boolean {
  return continueMarkup(view) || insertNewline(view)
}

export const editorTabKeymap = Prec.high(
  keymap.of([
    indentWithTab,
    { key: 'Shift-Tab', run: indentLess },
    { key: 'Enter', run: continueListOrNewline },
  ]),
)
