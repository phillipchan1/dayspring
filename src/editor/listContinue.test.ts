import { insertNewlineContinueMarkup, markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

// Guards the Enter binding in tabKeymap.ts: numbered/bulleted lists must
// continue on Enter (the editor previously bound Enter to a plain newline, so
// pressing Enter after "1. foo" just dropped to a blank line). Mirrors the
// editor's markdown config, including the IndentedCode removal.
const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: { remove: ['IndentedCode'] },
})

/** Run insertNewlineContinueMarkup with the cursor at `at`; report whether it
 *  handled the key and the resulting document. */
function pressEnter(doc: string, at: number): { handled: boolean; doc: string } {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(at),
    extensions: [mdExtension],
  })
  ensureSyntaxTree(state, doc.length) // force a full parse in the node test env
  let next = doc
  const handled = insertNewlineContinueMarkup({
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
