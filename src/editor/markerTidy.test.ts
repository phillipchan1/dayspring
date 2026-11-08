import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { markerTidy, tidyClosingMarker } from './markerTidy'

/** Type `ch` at the end of `doc` the way the keyboard does. */
function type(doc: string, ch: string, userEvent = 'input.type') {
  const state = EditorState.create({ doc, selection: { anchor: doc.length }, extensions: [markerTidy()] })
  const tr = state.update({
    changes: { from: doc.length, insert: ch },
    selection: { anchor: doc.length + ch.length },
    userEvent,
  })
  return { doc: tr.state.doc.toString(), caret: tr.state.selection.main.head }
}

describe('markerTidy', () => {
  it('moves the space a phone left before a typed closer outside it', () => {
    expect(type('**How do we learn? *', '*')).toEqual({ doc: '**How do we learn?** ', caret: 21 })
  })

  it('fixes a space after the opener too', () => {
    expect(type('** held *', '*').doc).toBe(' **held** ')
    expect(type('a ** held*', '*').doc).toBe('a  **held**')
  })

  it('works for strike, highlight and underline', () => {
    expect(type('~~gone ~', '~').doc).toBe('~~gone~~ ')
    expect(type('==this =', '=').doc).toBe('==this== ')
    expect(type('++this +', '+').doc).toBe('++this++ ')
  })

  it('leaves well-formed and unrelated text alone', () => {
    expect(type('**fine*', '*').doc).toBe('**fine**')
    expect(type('start *', '*').doc).toBe('start **') // an opener, nothing to close
    expect(type('**a** and *', '*').doc).toBe('**a** and **')
    expect(type('C++ is like C +', '+').doc).toBe('C++ is like C ++')
    expect(type('*** x *', '*').doc).toBe('*** x **')
  })

  it('ignores composition and non-typing edits', () => {
    expect(type('**x *', '*', 'input.type.compose').doc).toBe('**x **')
    expect(type('**x *', '*', 'input.paste').doc).toBe('**x **')
  })

  it('is one replacement ending at the caret', () => {
    expect(tidyClosingMarker('**x **', 6)).toEqual({ from: 0, to: 6, insert: '**x** ' })
    expect(tidyClosingMarker('**x **', 5)).toBeNull()
  })
})
