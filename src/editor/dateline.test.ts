// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { datelineExtension } from './dateline'

describe('datelineExtension', () => {
  it('sets the date above the first line, outside the document', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: 'Title\nbody', extensions: [datelineExtension('Thursday · October 1')] }),
      parent: document.body,
    })
    const el = view.dom.querySelector('.cm-dateline')
    expect(el?.textContent).toBe('Thursday · October 1')
    // Before the title's line, and never part of the entry's text.
    expect(el?.nextElementSibling?.textContent).toBe('Title')
    expect(view.state.doc.toString()).toBe('Title\nbody')
    view.destroy()
  })

  it('stays above the first line as the writer types into it', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: '', extensions: [datelineExtension('Thursday · October 1')] }),
      parent: document.body,
    })
    view.dispatch({ changes: { from: 0, insert: 'A new title\n' } })
    expect(view.dom.querySelector('.cm-dateline')?.nextElementSibling?.textContent).toBe('A new title')
    view.destroy()
  })
})
