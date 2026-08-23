// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { orderedListNumberingExtension } from './orderedListNumbering'

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: { remove: ['IndentedCode', 'SetextHeading'] },
})

function renderedLabels(doc: string): string[] {
  // Cursor at end of doc, away from every marker — isolates the nesting logic
  // from the "hide the marker under the cursor" behavior (covered separately below).
  const state = EditorState.create({
    doc,
    selection: { anchor: doc.length },
    extensions: [mdExtension, orderedListNumberingExtension()],
  })
  const view = new EditorView({ state, parent: document.body })
  const labels = Array.from(view.dom.querySelectorAll('.cm-list-label')).map((el) => el.textContent ?? '')
  view.destroy()
  return labels
}

describe('ordered list numbering decoration', () => {
  it('relabels nested items independently of their literal typed digits', () => {
    const doc = [
      '1. perfect prep',
      '   2. market read prep',
      '3. perfect read',
      '   4. the right signal',
      '5. perfect entry',
      '   6. getting in',
      '7. perfect risk management',
      '8. perfect reflection',
      '',
    ].join('\n')

    expect(renderedLabels(doc)).toEqual(['1.', 'a.', '2.', 'a.', '3.', 'a.', '4.', '5.'])
  })

  it('uses roman numerals two levels deep', () => {
    const doc = ['1. top', '   1. mid', '      1. deep', ''].join('\n')
    expect(renderedLabels(doc)).toEqual(['1.', 'a.', 'i.'])
  })

  it('honors the first item’s typed start (CommonMark <ol start>)', () => {
    expect(renderedLabels('2. starts here\n1. continues\n')).toEqual(['2.', '3.'])
  })

  it('honors a typed start when a new list begins after bullets', () => {
    // Column-0 bullets close the first <ol>. CommonMark only lets `1.`
    // interrupt a preceding block, so `2.` needs a blank line to be a list —
    // the shape after the user corrects the new list’s first marker.
    const doc = ['1. favor', '- nested', '- also nested', '', '2. next', ''].join('\n')
    expect(renderedLabels(doc)).toEqual(['1.', '2.'])
  })

  it('leaves the marker as raw digits while the selection overlaps it', () => {
    const doc = '1. top\n   2. nested\n'
    const state = EditorState.create({
      doc,
      selection: { anchor: 11 }, // inside the nested "2." marker
      extensions: [mdExtension, orderedListNumberingExtension()],
    })
    const view = new EditorView({ state, parent: document.body })
    const labels = Array.from(view.dom.querySelectorAll('.cm-list-label')).map((el) => el.textContent ?? '')
    // Top-level marker still decorated; the nested one under the cursor is raw.
    expect(labels).toEqual(['1.'])
    view.destroy()
  })
})
