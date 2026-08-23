// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import {
  copySelection,
  cutSelection,
  replaceSelection,
  selectAll,
  selectedText,
} from './selectionEdit'

function viewWith(doc: string, from: number, to: number): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: from, head: to },
    }),
    parent: document.body,
  })
}

describe('selectionEdit', () => {
  const written: string[] = []

  afterEach(() => {
    written.length = 0
    document.body.replaceChildren()
  })

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written.push(text)
        return Promise.resolve()
      },
      readText: () => Promise.resolve(written.at(-1) ?? ''),
    },
  })

  it('copies the selected document slice', () => {
    const view = viewWith('hello world', 0, 5)
    expect(copySelection(view)).toBe('hello')
    expect(written).toEqual(['hello'])
    expect(view.state.doc.toString()).toBe('hello world')
  })

  it('cuts the selected range and leaves the caret', () => {
    const view = viewWith('hello world', 6, 11)
    expect(cutSelection(view)).toBe('world')
    expect(view.state.doc.toString()).toBe('hello ')
    expect(view.state.selection.main.from).toBe(6)
  })

  it('replaces the selection and keeps it selected', () => {
    const view = viewWith('teh cat', 0, 3)
    replaceSelection(view, 'the')
    expect(view.state.doc.toString()).toBe('the cat')
    expect(view.state.selection.main.from).toBe(0)
    expect(view.state.selection.main.to).toBe(3)
  })

  it('selects the whole document', () => {
    const view = viewWith('ab\ncd', 1, 1)
    selectAll(view)
    expect(selectedText(view)).toBe('ab\ncd')
    expect(view.state.selection.main.from).toBe(0)
    expect(view.state.selection.main.to).toBe(5)
  })
})
