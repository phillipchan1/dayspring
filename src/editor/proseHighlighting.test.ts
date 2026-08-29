// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { HighlightExtension, UnderlineExtension } from './markdownMarks'
import { proseHighlighting } from './proseHighlighting'

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: [
    { remove: ['IndentedCode', 'SetextHeading'] },
    HighlightExtension,
    UnderlineExtension,
  ],
})

function highlightRanges(doc: string, caret: number): { from: number; to: number }[] {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: caret },
      extensions: [mdExtension, proseHighlighting()],
    }),
    parent: document.createElement('div'),
  })
  const out: { from: number; to: number }[] = []
  for (const input of view.state.facet(EditorView.decorations)) {
    const set = typeof input === 'function' ? input(view) : input
    const iter = set.iter()
    while (iter.value) {
      if (iter.value.spec.class) out.push({ from: iter.from, to: iter.to })
      iter.next()
    }
  }
  view.destroy()
  return out
}

describe('proseHighlighting', () => {
  const doc = '# Title\n\nplain words'

  it('leaves the caret line without highlight marks so the OS can spellcheck it', () => {
    const onTitle = highlightRanges(doc, 2)
    expect(onTitle.filter((r) => r.from < 7)).toEqual([])
  })

  it('still paints finished lines once the caret has left them', () => {
    const onBody = highlightRanges(doc, doc.length)
    expect(onBody.some((r) => r.from < 7)).toBe(true)
    expect(onBody.filter((r) => r.from >= 9)).toEqual([])
  })
})
