// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { deleteCharBackward, insertNewline } from '@codemirror/commands'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { drawnQuotesExtension } from './drawnQuotes'
import { editorTabKeymap } from './tabKeymap'
import { writerWords } from '@/lib/writerWords'

/**
 * A drawn quote is the passage's words: the writer can take it out, never
 * change it, and nothing they type becomes part of it. Phil hit both sides on
 * 2026-09-27 — Enter after a quote carried `>` onto his own line (so it was
 * stored as Scripture), and a stray `>` row sent the next quote's line to the
 * wrong place.
 */

const Q = '> And I saw no temple in the city (v. 22)'
let view: EditorView | null = null

function open(doc: string, caret: number) {
  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(caret),
      extensions: [drawnQuotesExtension(), editorTabKeymap, markdown({ base: markdownLanguage })],
    }),
    parent: document.body,
  })
  return view
}
afterEach(() => {
  view?.destroy()
  view = null
})

const type = (v: EditorView, text: string) => {
  const at = v.state.selection.main.head
  v.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: 'input.type' })
}
const enter = (v: EditorView) =>
  runScopeHandlers(v, new KeyboardEvent('keydown', { key: 'Enter' }), 'editor') || insertNewline(v)
const doc = (v: EditorView) => v.state.doc.toString()

describe('drawn quotes', () => {
  it('Enter at the end of a quote starts the writer’s own paragraph, not another `>`', () => {
    const v = open(Q, Q.length)
    enter(v)
    type(v, 'no more intermediary')
    expect(doc(v)).toBe(`${Q}\n\nno more intermediary`)
    expect(writerWords(`<!-- ritual:name:Open Reading -->\n${doc(v)}`)).toBe('no more intermediary')
  })

  it('Enter reuses the blank line already below a quote', () => {
    const v = open(`${Q}\n\nmine`, Q.length)
    enter(v)
    type(v, 'new')
    expect(doc(v)).toBe(`${Q}\n\nnew\n\nmine`)
  })

  it('typing right after a quote moves the words below it', () => {
    const v = open(Q, Q.length)
    type(v, 'h')
    type(v, 'i')
    expect(doc(v)).toBe(`${Q}\n\nhi`)
  })

  it('typing at the start of a quote writes above it', () => {
    const v = open(Q, 0)
    type(v, 'first')
    expect(doc(v)).toBe(`first\n\n${Q}`)
  })

  it('refuses a change inside a quote', () => {
    const v = open(Q, 10)
    v.dispatch({ changes: { from: 10, insert: 'x' }, userEvent: 'input.type' })
    expect(doc(v)).toBe(Q)
  })

  it('Backspace into a quote takes the whole quote', () => {
    const v = open(`mine\n\n${Q}`, 6 + Q.length)
    deleteCharBackward(v)
    expect(doc(v)).toBe('mine\n\n')
  })

  it('will not glue the writer’s line onto a quote — it selects the quote instead', () => {
    const start = `${Q}\n\nmine`
    const v = open(start, Q.length + 1)
    deleteCharBackward(v) // removes the blank line, which would fold "mine" into the quote
    expect(doc(v)).toBe(start)
    expect(v.state.selection.main.from).toBe(0)
    expect(v.state.selection.main.to).toBe(Q.length)
    deleteCharBackward(v) // a second press removes it
    expect(doc(v)).toBe('\n\nmine')
  })

  it('lets the composer place a quote (no user event)', () => {
    const v = open('mine', 4)
    v.dispatch({ changes: { from: 4, insert: `\n\n${Q}\n\n` } })
    expect(doc(v)).toBe(`mine\n\n${Q}\n\n`)
  })

  it('leaves ordinary lines alone', () => {
    const v = open('mine', 4)
    type(v, ' too')
    enter(v)
    type(v, 'next')
    expect(doc(v)).toBe('mine too\nnext')
  })
})
