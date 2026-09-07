// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { highlightDecoration } from './highlightDecoration'
import { HighlightExtension, UnderlineExtension } from './markdownMarks'
import { spiritualBlocksField } from './spiritualBlocksField'

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: [
    { remove: ['IndentedCode', 'SetextHeading'] },
    HighlightExtension,
    UnderlineExtension,
  ],
})

function ranges(doc: string): { from: number; to: number; cls: string }[] {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [spiritualBlocksField, mdExtension, highlightDecoration()],
    }),
    parent: document.createElement('div'),
  })
  const out: { from: number; to: number; cls: string }[] = []
  for (const input of view.state.facet(EditorView.decorations)) {
    const set = typeof input === 'function' ? input(view) : input
    const iter = set.iter()
    while (iter.value) {
      out.push({ from: iter.from, to: iter.to, cls: String(iter.value.spec.class ?? '') })
      iter.next()
    }
  }
  view.destroy()
  return out
}

describe('highlightDecoration', () => {
  it('paints a bare highlight', () => {
    const doc = 'a ==word== b'
    expect(ranges(doc)).toEqual([{ from: 4, to: 8, cls: 'cm-hl cm-hl--amber' }])
  })

  it('paints a wrap that captured a trailing space', () => {
    const doc = '==foo =='
    const rs = ranges(doc)
    expect(rs).toHaveLength(1)
    expect(doc.slice(rs[0]!.from, rs[0]!.to)).toBe('foo ')
    expect(rs[0]!.cls).toContain('cm-hl--amber')
  })

  it('paints each line of a two-line wrap', () => {
    const doc = '==foo\nbar=='
    const rs = ranges(doc)
    expect(rs).toHaveLength(2)
    expect(doc.slice(rs[0]!.from, rs[0]!.to)).toBe('foo')
    expect(doc.slice(rs[1]!.from, rs[1]!.to)).toBe('bar')
  })
})
