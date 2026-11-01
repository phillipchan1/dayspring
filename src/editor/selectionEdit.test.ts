// @vitest-environment jsdom
import { EditorState, Transaction, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import {
  copySelection,
  cutSelection,
  pasteSelection,
  replaceSelection,
  selectAll,
  selectedText,
} from './selectionEdit'

/**
 * Destroyed after each test: a live view gets a measure frame later, which
 * jsdom can't lay out (see liveFormatting.test.ts).
 */
const mounted: EditorView[] = []

function viewWith(doc: string, from: number, to: number, extensions: Extension = []): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: from, head: to },
      extensions,
    }),
    parent: document.body,
  })
  mounted.push(view)
  return view
}

/** Record every transaction's user event. */
function recorder(): { events: (string | undefined)[]; ext: Extension } {
  const events: (string | undefined)[] = []
  return {
    events,
    ext: EditorView.updateListener.of((u) => {
      for (const tr of u.transactions as readonly Transaction[]) {
        if (tr.docChanged) events.push(tr.annotation(Transaction.userEvent))
      }
    }),
  }
}

describe('selectionEdit', () => {
  const written: string[] = []

  afterEach(() => {
    written.length = 0
    for (const view of mounted.splice(0)) view.destroy()
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

  it('a bar paste is a paste: input filters, then input.paste', async () => {
    const rec = recorder()
    const view = viewWith('hello world', 6, 11, [
      rec.ext,
      EditorView.clipboardInputFilter.of((text) => text.toUpperCase()),
    ])
    written.push('there')
    await pasteSelection(view)
    expect(view.state.doc.toString()).toBe('hello THERE')
    expect(rec.events).toEqual(['input.paste'])
  })

  it('a bar cut is a cut', () => {
    const rec = recorder()
    const view = viewWith('hello world', 6, 11, rec.ext)
    cutSelection(view)
    expect(rec.events).toEqual(['delete.cut'])
  })

  it('copy goes through the clipboard output filters', () => {
    const view = viewWith('hello world', 0, 5, EditorView.clipboardOutputFilter.of((t) => `«${t}»`))
    expect(copySelection(view)).toBe('«hello»')
  })
})
