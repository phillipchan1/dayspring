// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { concealMarkersExtension } from './concealMarkers'
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

/**
 * The document substrings the plugin is hiding, in order.
 *
 * Read through the atomicRanges facet, which the extension feeds from the very
 * same DecorationSet it renders — so this asserts the decisions, not the DOM.
 * The conceal plugin is the only atomicRanges provider in this test's extension
 * set.
 */
function concealed(doc: string, selection?: EditorSelection | { anchor: number; head?: number }): string[] {
  const state = EditorState.create({
    doc,
    // Default the caret to the very end, away from every span.
    selection: selection ?? { anchor: doc.length },
    extensions: [
      // Multiple cursors are dropped by CodeMirror unless this is enabled.
      EditorState.allowMultipleSelections.of(true),
      spiritualBlocksField,
      mdExtension,
      concealMarkersExtension(),
    ],
  })
  const view = new EditorView({ state, parent: document.body })
  const out: string[] = []
  for (const provider of view.state.facet(EditorView.atomicRanges)) {
    const iter = provider(view).iter()
    while (iter.value) {
      out.push(doc.slice(iter.from, iter.to))
      iter.next()
    }
  }
  view.destroy()
  return out
}

describe('concealMarkers', () => {
  it('hides inline emphasis markers when the caret is elsewhere', () => {
    expect(concealed('one *two* three')).toEqual(['*', '*'])
    expect(concealed('one **two** three')).toEqual(['**', '**'])
    expect(concealed('one ~~two~~ three')).toEqual(['~~', '~~'])
    expect(concealed('one `two` three')).toEqual(['`', '`'])
  })

  it('hides the highlight and underline markers, colour spec included', () => {
    expect(concealed('a =={rose}b== c')).toEqual(['=={rose}', '=='])
    expect(concealed('a ++b++ c')).toEqual(['++', '++'])
    // Trailing prose keeps the caret (parked at doc end) outside the span,
    // which is what actually conceals. `==foo ==` filling the whole doc would
    // leave the caret on the closer and reveal.
    expect(concealed('x ==foo == y')).toEqual(['==', '=='])
    expect(concealed('x ==foo\nbar == y')).toEqual(['==', '=='])
  })

  it('swallows the space after a heading hash so the text does not indent', () => {
    expect(concealed('# Title\n\nbody')).toEqual(['# '])
  })

  it('hides a link down to its label', () => {
    expect(concealed('see [the docs](https://x.com) now')).toEqual([
      '[',
      ']',
      '(',
      'https://x.com',
      ')',
    ])
  })

  // "- " IS the bullet, and ">" is the only sign a line is a quote.
  it('never hides list or quote markers', () => {
    expect(concealed('- an item')).toEqual([])
    expect(concealed('> a quote')).toEqual([])
    expect(concealed('- [ ] a task')).toEqual([])
  })

  it('leaves a fenced spiritual block completely alone', () => {
    const doc = ['```dayspring-pray 11111111-2222-3333-4444-555555555555', 'for *her*', '```', ''].join(
      '\n',
    )
    expect(concealed(doc)).toEqual([])
  })
})

describe('concealMarkers — the reveal rule', () => {
  const doc = 'one *two* three'
  // "one " is 0-3, "*" is 4, "two" is 5-7, "*" is 8.

  it('reveals when the caret is inside the span', () => {
    expect(concealed(doc, { anchor: 6 })).toEqual([])
  })

  it('reveals when the caret sits at the span start', () => {
    // Inclusive on purpose: otherwise Backspace here deletes an invisible "*".
    expect(concealed(doc, { anchor: 4 })).toEqual([])
  })

  it('reveals when the caret sits at the span end', () => {
    expect(concealed(doc, { anchor: 9 })).toEqual([])
  })

  it('stays hidden one character outside the span', () => {
    expect(concealed(doc, { anchor: 3 })).toEqual(['*', '*'])
    expect(concealed(doc, { anchor: 10 })).toEqual(['*', '*'])
  })

  it('reveals every span a selection covers', () => {
    const multi = '*a* and *b*'
    expect(concealed(multi, { anchor: 0, head: multi.length })).toEqual([])
  })

  it('reveals only the touched span when there are several', () => {
    const multi = '*a* and *b*'
    // Caret inside the first span only.
    expect(concealed(multi, { anchor: 1 })).toEqual(['*', '*'])
  })

  it('reveals every span touched by a multi-cursor selection', () => {
    const multi = '*a* and *b*'
    const sel = EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(9)], 0)
    expect(concealed(multi, sel)).toEqual([])
  })

  it('reveals a heading hash from anywhere on its line', () => {
    expect(concealed('# Title\n\nbody', { anchor: 4 })).toEqual([])
  })
})
