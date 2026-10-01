// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { listLayoutExtension } from './listLayout'
import { orderedListNumberingExtension } from './orderedListNumbering'
import { spiritualBlocksField } from './spiritualBlocksField'
import { taskListExtension } from './taskListExtension'

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: { remove: ['IndentedCode', 'SetextHeading'] },
})

function mount(doc: string, anchor = doc.length) {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [
      spiritualBlocksField,
      mdExtension,
      orderedListNumberingExtension(),
      taskListExtension(),
      listLayoutExtension(),
    ],
  })
  return new EditorView({ state, parent: document.body })
}

/** Document text the list layout hides or replaces (its atomic ranges). */
function hidden(view: EditorView): string[] {
  const doc = view.state.doc.toString()
  const out: string[] = []
  for (const provider of view.state.facet(EditorView.atomicRanges)) {
    const iter = provider(view).iter()
    while (iter.value) {
      if (iter.to > iter.from) out.push(doc.slice(iter.from, iter.to))
      iter.next()
    }
  }
  return out
}

/** `--li-depth` of each hanging line, top to bottom. */
function depths(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll<HTMLElement>('.cm-li')).map((el) =>
    el.style.getPropertyValue('--li-depth'),
  )
}

describe('list layout', () => {
  it('hangs every item one marker column per level', () => {
    const view = mount('- one\n- two\n   - nested\n      - deeper\n\ntail')
    expect(depths(view)).toEqual(['1', '1', '2', '3'])
    view.destroy()
  })

  it('draws a bullet per level, and hides the indent and the gap after it', () => {
    const view = mount('- one\n   - nested\n\ntail')
    const kinds = Array.from(view.dom.querySelectorAll('.cm-li-bullet')).map((el) => el.className)
    expect(kinds).toEqual(['cm-li-bullet cm-li-bullet--1', 'cm-li-bullet cm-li-bullet--2'])
    expect(hidden(view)).toEqual(['-', ' ', '   ', '-', ' '])
    view.destroy()
  })

  it('shows the dash as typed while the caret is on it', () => {
    const doc = '- one\n- two\n'
    const view = mount(doc, 7) // after the second line's `-`
    expect(view.dom.querySelectorAll('.cm-li-bullet')).toHaveLength(1)
    // Still hanging — revealing the character must not reflow the line.
    expect(depths(view)).toEqual(['1', '1'])
    view.destroy()
  })

  it('keeps a bullet under a caret at the start of the words', () => {
    const view = mount('- one\n', 2)
    expect(view.dom.querySelectorAll('.cm-li-bullet')).toHaveLength(1)
    view.destroy()
  })

  it('sets ordered items in the same column, leaving the label to orderedListNumbering', () => {
    const view = mount('1. one\n2. two\n\ntail')
    expect(depths(view)).toEqual(['1', '1'])
    expect(view.dom.querySelectorAll('.cm-li-bullet')).toHaveLength(0)
    expect(Array.from(view.dom.querySelectorAll('.cm-list-label')).map((el) => el.textContent)).toEqual([
      '1.',
      '2.',
    ])
    view.destroy()
  })

  it('drops the dash a checkbox makes redundant, on bulleted and bare tasks alike', () => {
    const view = mount('- [ ] bulleted\n[] bare\n\ntail')
    expect(depths(view)).toEqual(['1', '1'])
    expect(view.dom.querySelectorAll('.cm-task-checkbox')).toHaveLength(2)
    expect(view.dom.querySelectorAll('.cm-li-bullet')).toHaveLength(0)
    expect(hidden(view)).toEqual(['- ', ' ', ' '])
    view.destroy()
  })

  it('leaves a marking alone, even when its words look like a list', () => {
    const view = mount(
      '```dayspring-pray 22222222-2222-4222-8222-222222222222\n- not a list here\n```\n\ntail',
    )
    expect(depths(view)).toEqual([])
    view.destroy()
  })
})
