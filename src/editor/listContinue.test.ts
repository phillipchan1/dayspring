import { insertNewlineContinueMarkup, markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { continueMarkup } from './tabKeymap'

// Guards the Enter binding in tabKeymap.ts: numbered/bulleted lists must
// continue on Enter (the editor previously bound Enter to a plain newline, so
// pressing Enter after "1. foo" just dropped to a blank line). Mirrors the
// editor's markdown config, including the IndentedCode removal.
const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: { remove: ['IndentedCode', 'SetextHeading'] },
})

/** Run insertNewlineContinueMarkup with the cursor at `at`; report whether it
 *  handled the key and the resulting document. */
function pressEnter(
  doc: string,
  at: number,
  command = insertNewlineContinueMarkup,
): { handled: boolean; doc: string } {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(at),
    extensions: [mdExtension],
  })
  ensureSyntaxTree(state, doc.length) // force a full parse in the node test env
  let next = doc
  const handled = command({
    state,
    dispatch: (tr) => {
      next = tr.state.doc.toString()
    },
  })
  return { handled, doc: next }
}

describe('Enter continues list markup', () => {
  it('continues a numbered list and increments', () => {
    const { handled, doc } = pressEnter('1. trading blows this week', 26)
    expect(handled).toBe(true)
    expect(doc).toBe('1. trading blows this week\n2. ')
  })

  it('continues a bulleted list', () => {
    const { handled, doc } = pressEnter('- first', 7)
    expect(handled).toBe(true)
    expect(doc).toBe('- first\n- ')
  })

  it('falls through on plain prose (so the fallback inserts a bare newline)', () => {
    // Not in a list/quote → returns false → tabKeymap falls back to insertNewline.
    expect(pressEnter('here is a sentence', 18).handled).toBe(false)
  })
})

// The command tabKeymap actually binds. Enter on an EMPTY item must step out a
// level. CodeMirror's default (nonTightLists) instead pushed a blank line with
// a lone space above a tight list's second item and kept the caret in place —
// so Enter-twice never ended a freshly nested list.
describe('Enter on an empty item (tabKeymap)', () => {
  it('outdents an empty nested item to its parent level', () => {
    const doc = '- first\n   - nested\n   - '
    expect(pressEnter(doc, doc.length, continueMarkup).doc).toBe('- first\n   - nested\n- ')
  })

  it('ends a top-level list on an empty item', () => {
    const doc = '- first\n- '
    expect(pressEnter(doc, doc.length, continueMarkup).doc).toBe('- first\n')
  })

  it('still continues a list from a non-empty item', () => {
    expect(pressEnter('- first', 7, continueMarkup).doc).toBe('- first\n- ')
  })
})
