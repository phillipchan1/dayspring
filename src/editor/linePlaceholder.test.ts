// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_PLACEHOLDER_CLASS,
  bodyLinePlaceholder,
  emptyDocPlaceholder,
} from './linePlaceholder'

function decoSpecs(view: EditorView): { widget: boolean; class: string | undefined }[] {
  const out: { widget: boolean; class: string | undefined }[] = []
  for (const input of view.state.facet(EditorView.decorations)) {
    const set = typeof input === 'function' ? input(view) : input
    const iter = set.iter()
    while (iter.value) {
      out.push({
        widget: Boolean(iter.value.spec.widget),
        class: iter.value.spec.class as string | undefined,
      })
      iter.next()
    }
  }
  return out
}

describe('emptyDocPlaceholder', () => {
  it('paints a line class on an empty page, not a widget in the caret line', () => {
    const view = new EditorView({
      state: EditorState.create({ extensions: [emptyDocPlaceholder('Write…')] }),
      parent: document.createElement('div'),
    })
    const specs = decoSpecs(view)
    expect(specs.some((s) => s.widget)).toBe(false)
    expect(specs.some((s) => s.class === EMPTY_PLACEHOLDER_CLASS)).toBe(true)
    expect(view.contentDOM.querySelector('.cm-placeholder')).toBeNull()
    expect(view.contentDOM.querySelector('.cm-line')?.classList.contains(EMPTY_PLACEHOLDER_CLASS)).toBe(
      true,
    )
    expect(view.contentDOM.getAttribute('aria-placeholder')).toBe('Write…')
    view.destroy()
  })

  it('clears the hint as soon as the writer types, still without a widget', () => {
    const view = new EditorView({
      state: EditorState.create({ extensions: [emptyDocPlaceholder('Write…')] }),
      parent: document.createElement('div'),
    })
    view.dispatch({ changes: { from: 0, insert: 'teh' } })
    const specs = decoSpecs(view)
    expect(specs.some((s) => s.widget)).toBe(false)
    expect(specs.some((s) => s.class === EMPTY_PLACEHOLDER_CLASS)).toBe(false)
    expect(view.contentDOM.querySelector('.cm-placeholder')).toBeNull()
    view.destroy()
  })
})

describe('bodyLinePlaceholder', () => {
  it('hints the empty body line with a line class after a title, not a widget', () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Morning\n',
        extensions: [bodyLinePlaceholder('Keep going')],
      }),
      parent: document.createElement('div'),
    })
    const specs = decoSpecs(view)
    expect(specs.some((s) => s.widget)).toBe(false)
    expect(specs.some((s) => s.class === EMPTY_PLACEHOLDER_CLASS)).toBe(true)
    expect(view.contentDOM.querySelector('.cm-placeholder')).toBeNull()
    view.destroy()
  })
})
