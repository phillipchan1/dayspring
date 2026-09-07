// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { HighlightExtension, UnderlineExtension } from './markdownMarks'
import { spiritualBlocksField } from './spiritualBlocksField'
import { horizontalRuleExtension } from './horizontalRule'

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: [
    { remove: ['IndentedCode', 'SetextHeading'] },
    HighlightExtension,
    UnderlineExtension,
  ],
})

function mount(doc: string, anchor?: number): EditorView {
  const state = EditorState.create({
    doc,
    selection: { anchor: anchor ?? doc.length },
    extensions: [spiritualBlocksField, mdExtension, horizontalRuleExtension()],
  })
  return new EditorView({ state, parent: document.body })
}

function rules(view: EditorView): number {
  return view.dom.querySelectorAll('.cm-hr').length
}

describe('horizontalRuleExtension', () => {
  it('replaces --- *** and ___ with a decorative rule when the caret is elsewhere', () => {
    const doc = 'before\n\n---\n\n***\n\n___\n\nafter'
    const view = mount(doc)
    expect(rules(view)).toBe(3)
    view.destroy()
  })

  it('treats a longer run of dashes as a rule', () => {
    const view = mount('before\n\n-----\n\nafter')
    expect(rules(view)).toBe(1)
    view.destroy()
  })

  it('does not treat two dashes, an em dash, or inline dashes as a rule', () => {
    const view = mount('before\n\n--\n\n—\n\nword --- word\n\nafter')
    expect(rules(view)).toBe(0)
    view.destroy()
  })

  it('reveals the source when the caret sits on the rule’s line', () => {
    const doc = 'before\n\n---\n\nafter'
    const atRule = doc.indexOf('---')
    const view = mount(doc, atRule)
    expect(rules(view)).toBe(0)
    expect(view.state.doc.lineAt(atRule).text).toBe('---')
    view.destroy()
  })

  it('reveals when a selection covers the rule', () => {
    const doc = 'before\n\n---\n\nafter'
    const state = EditorState.create({
      doc,
      selection: { anchor: 0, head: doc.length },
      extensions: [spiritualBlocksField, mdExtension, horizontalRuleExtension()],
    })
    const view = new EditorView({ state, parent: document.body })
    expect(rules(view)).toBe(0)
    view.destroy()
  })

  it('leaves a --- inside a spiritual fence as text', () => {
    const doc = [
      '```dayspring-pray 11111111-2222-3333-4444-555555555555',
      '---',
      '```',
      '',
      'after',
    ].join('\n')
    const view = mount(doc)
    expect(rules(view)).toBe(0)
    view.destroy()
  })

  it('keeps the underlying markdown as --- so the entry is unchanged', () => {
    const doc = 'before\n\n---\n\nafter'
    const view = mount(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})
