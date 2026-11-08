// @vitest-environment jsdom
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { applyFormat, buildInline, EMPTY_INLINE, getFormatState, type FormatAction } from './formatSelection'

/**
 * Regression: selecting a whole bullet line on iOS (which takes the trailing
 * space with it) and pressing B wrote `**- How do we learn? **` — no bold (a
 * closer can't follow a space) and no bullet (the `- ` was swallowed).
 */
function press(doc: string, from: number, to: number, action: FormatAction = 'bold') {
  const view = new EditorView({
    state: EditorState.create({ doc, selection: { anchor: from, head: to }, extensions: [markdown()] }),
  })
  applyFormat(view, action)
  return view
}
const after = (doc: string, from: number, to: number, action: FormatAction = 'bold') =>
  press(doc, from, to, action).state.doc.toString()

describe('formatting a selection is robust to what a phone selects', () => {
  it('keeps the bullet outside and the trailing space outside', () => {
    const line = '- How do we learn? '
    expect(after(line, 0, line.length)).toBe('- **How do we learn?** ')
  })

  it('keeps heading, quote, number and task prefixes outside', () => {
    expect(after('## Title', 0, 8)).toBe('## **Title**')
    expect(after('> said it', 0, 9)).toBe('> **said it**')
    expect(after('1. first', 0, 8)).toBe('1. **first**')
    expect(after('- [ ] task', 0, 10)).toBe('- [ ] **task**')
  })

  it('puts a double-tapped word’s trailing space outside the pair', () => {
    expect(after('word next', 0, 5)).toBe('**word** next')
    expect(after('a  word', 1, 7)).toBe('a  **word**')
  })

  it('formats a multi-line selection line by line, never one pair across lines', () => {
    expect(after('a line\nb line', 0, 13)).toBe('**a line**\n**b line**')
    expect(after('- one\n\n- two', 0, 12)).toBe('- **one**\n\n- **two**')
  })

  it('toggles a multi-line selection as one: on unless every line has it', () => {
    expect(after('- **a**\n- b', 0, 11)).toBe('- **a**\n- **b**')
    expect(after('- **a**\n- **b**', 0, 15)).toBe('- a\n- b')
  })

  it('works for every inline mark, not just bold', () => {
    expect(after('- note ', 0, 7, 'italic')).toBe('- *note* ')
    expect(after('- note ', 0, 7, 'strike')).toBe('- ~~note~~ ')
    expect(after('- note ', 0, 7, 'underline')).toBe('- ++note++ ')
    expect(after('- note ', 0, 7, 'highlight')).toBe('- ==note== ')
  })

  it('opens an empty pair when only whitespace or a bullet is selected', () => {
    expect(after('-   ', 0, 4)).toBe('-   ****')
  })

  it('a second press undoes the first', () => {
    const line = '- How do we learn? '
    const view = press(line, 0, line.length)
    applyFormat(view, 'bold')
    expect(view.state.doc.toString()).toBe(line)
  })
})

describe('an already-broken span is repaired, not toggled off', () => {
  const broken = '**- How do we learn? **'

  it('reads as not bold — that is what the writer sees', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: broken, selection: { anchor: 0, head: broken.length }, extensions: [markdown()] }),
    })
    expect(getFormatState(view).inline.bold).toBe(false)
  })

  it('repairs from a selection or a caret anywhere inside', () => {
    expect(after(broken, 0, broken.length)).toBe('- **How do we learn?** ')
    expect(after(broken, 10, 10)).toBe('- **How do we learn?** ')
    expect(after('**text **', 3, 3)).toBe('**text** ')
    expect(after('~~ gone~~', 4, 4, 'strike')).toBe(' ~~gone~~')
  })

  it('leaves a working span’s toggle alone', () => {
    expect(after('**bold**', 0, 8)).toBe('bold')
    expect(after('a **b** c', 5, 5)).toBe('a b c')
  })
})

describe('buildInline never puts whitespace inside a pair', () => {
  it('moves edge whitespace outside', () => {
    expect(buildInline(' x ', { ...EMPTY_INLINE, bold: true })).toBe(' **x** ')
    expect(buildInline('x\n', { ...EMPTY_INLINE, italic: true })).toBe('*x*\n')
    expect(buildInline('  ', { ...EMPTY_INLINE, bold: true })).toBe('**  **')
  })
})
