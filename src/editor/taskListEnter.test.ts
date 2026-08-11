// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { editorTabKeymap } from './tabKeymap'
import { taskListExtension } from './taskListExtension'

// Guards against a regression where editorTabKeymap's Enter handler (bound to
// insertNewlineContinueMarkup, which always falls back to a bare newline) shadowed
// taskListExtension's Enter handler because both sat at the same Prec.high tier and
// tabKeymap was registered first in Editor.tsx. Checklist lines never continued.
const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: { remove: ['IndentedCode', 'SetextHeading'] },
})

function pressEnter(doc: string, at: number): string {
  const state = EditorState.create({
    doc,
    selection: { anchor: at },
    extensions: [mdExtension, editorTabKeymap, taskListExtension()],
  })
  const view = new EditorView({ state, parent: document.body })
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  runScopeHandlers(view, event, 'editor')
  const result = view.state.doc.toString()
  view.destroy()
  return result
}

describe('Enter continues checklist markup', () => {
  it('continues a bare [] checklist item', () => {
    expect(pressEnter('[] first task', 13)).toBe('[] first task\n[] ')
  })

  it('continues a bulleted checklist item', () => {
    expect(pressEnter('- [] first task', 15)).toBe('- [] first task\n- [ ] ')
  })

  it('continues a checked checklist item as unchecked', () => {
    expect(pressEnter('- [x] done task', 15)).toBe('- [x] done task\n- [ ] ')
  })
})
