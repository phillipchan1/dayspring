// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { checkEditorInvariant, checkSelection, checkText } from './invariant'

function mount(doc: string): EditorView {
  return new EditorView({ doc, parent: document.body })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('editor invariant', () => {
  it('holds for a freshly rendered entry', () => {
    const view = mount('Morning\n\nFirst paragraph.\n\n\n')
    expect(checkEditorInvariant(view)).toEqual([])
    view.destroy()
  })

  it('reports a line whose DOM no longer reads what the document holds', () => {
    const view = mount('Morning\n\nFirst paragraph.')
    // Before CodeMirror's observer gets to it — the window a desync lives in.
    const text = view.contentDOM.querySelectorAll('.cm-line')[2]!.firstChild as Text
    text.data = 'First paragraph, edited behind the editor’s back.'
    const found = checkText(view)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'text', detail: { line: 3, doc: 'First paragraph.' } })
    view.destroy()
  })

  it("reports a DOM caret that is not where the editor's selection is", () => {
    const view = mount('one\n\ntwo\n\n')
    view.focus()
    view.dispatch({ selection: { anchor: 0 } })
    expect(checkSelection(view)).toEqual([])
    // The caret moves in the page; the state never hears about it.
    const last = view.contentDOM.lastElementChild!
    view.contentDOM.ownerDocument.getSelection()!.collapse(last, 0)
    const found = checkSelection(view)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'selection', detail: { state: { head: 0 }, dom: { head: 10 } } })
    view.destroy()
  })
})
