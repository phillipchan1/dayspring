// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { HighlightExtension, UnderlineExtension } from './markdownMarks'
import { markdownHighlight } from './highlight'
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

function collect(view: EditorView): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  for (const input of view.state.facet(EditorView.decorations)) {
    const set = typeof input === 'function' ? input(view) : input
    const iter = set.iter()
    while (iter.value) {
      if (iter.value.spec.class) out.push({ from: iter.from, to: iter.to })
      iter.next()
    }
  }
  return out
}

function highlightRanges(doc: string, caret: number): { from: number; to: number }[] {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: caret },
      extensions: [mdExtension, proseHighlighting()],
    }),
    parent: document.createElement('div'),
  })
  const out = collect(view)
  view.destroy()
  return out
}

describe('proseHighlighting', () => {
  const doc = '# Title\n\nplain words'

  it('mounts the highlight stylesheet so finished lines still paint', () => {
    expect(markdownHighlight.module).not.toBeNull()
  })

  it('leaves a heading unmarked while the caret is still on that line', () => {
    const onTitle = highlightRanges(doc, 2)
    expect(onTitle.filter((r) => r.from < 7)).toEqual([])
  })

  it('still paints finished lines once the caret has left them', () => {
    const onBody = highlightRanges(doc, doc.length)
    expect(onBody.some((r) => r.from < 7)).toBe(true)
    expect(onBody.filter((r) => r.from >= 9)).toEqual([])
  })

  it('paints finished inline marks on the caret line once the caret has left the word', () => {
    const line = '**bold** and more'
    const inMore = highlightRanges(line, line.length)
    expect(inMore.some((r) => r.from < 8)).toBe(true)
    expect(inMore.filter((r) => r.from >= 13)).toEqual([])

    const italic = '*hi* there'
    expect(highlightRanges(italic, italic.length).some((r) => r.from < 4)).toBe(true)
  })

  it('paints a closed inline mark as soon as the caret sits at its end', () => {
    expect(highlightRanges('**bold**', 8).length).toBeGreaterThan(0)
    expect(highlightRanges('*hi*', 4).length).toBeGreaterThan(0)
  })

  it('does not paint an inline mark while the caret is still inside it', () => {
    expect(highlightRanges('**bold**', 4)).toEqual([])
    expect(highlightRanges('**bol', 5)).toEqual([])
    expect(highlightRanges('**bold**more', 12)).toEqual([])
  })

  it('paints when the caret leaves a mark on the same line without a doc change', () => {
    const doc = '**bold** next'
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: 4 },
        extensions: [mdExtension, proseHighlighting()],
      }),
      parent: document.createElement('div'),
    })
    expect(collect(view).filter((r) => r.from < 8)).toEqual([])
    view.dispatch({ selection: { anchor: doc.length } })
    expect(collect(view).some((r) => r.from < 8)).toBe(true)
    view.destroy()
  })
})
