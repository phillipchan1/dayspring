// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { scriptureRefDecoration } from './scriptureRefDecoration'
import { spiritualBlocksField } from './spiritualBlocksField'

function refRanges(doc: string, caret: number): { from: number; to: number }[] {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: caret },
      extensions: [spiritualBlocksField, scriptureRefDecoration()],
    }),
    parent: document.createElement('div'),
  })
  const out: { from: number; to: number }[] = []
  for (const input of view.state.facet(EditorView.decorations)) {
    const set = typeof input === 'function' ? input(view) : input
    const iter = set.iter()
    while (iter.value) {
      if (iter.value.spec.class === 'cm-scriptureRef') out.push({ from: iter.from, to: iter.to })
      iter.next()
    }
  }
  view.destroy()
  return out
}

describe('scriptureRefDecoration', () => {
  const doc = 'John 3:16\n\nnext line'

  it('does not underline a reference on the caret line', () => {
    expect(refRanges(doc, 0)).toEqual([])
  })

  it('underlines the reference once the caret has left the line', () => {
    expect(refRanges(doc, doc.length).length).toBeGreaterThan(0)
  })
})
