// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  caretLineRange,
  caretWordRange,
  overlapsCaretLine,
  overlapsCaretWord,
} from './caretLine'

function state(doc: string, anchor: number, head?: number) {
  return EditorState.create({
    doc,
    selection: head == null ? { anchor } : { anchor, head },
  })
}

describe('caretLine', () => {
  it('reports the line the caret is on', () => {
    const s = state('one\ntwo\nthree', 5)
    expect(caretLineRange(s)).toEqual({ from: 4, to: 7 })
  })

  it('treats a range on another line as outside', () => {
    const s = state('# Title\n\nbody', 10)
    expect(overlapsCaretLine(s, 0, 7)).toBe(false)
    expect(overlapsCaretLine(s, 9, 13)).toBe(true)
  })
})

describe('caretWord', () => {
  it('reports the whitespace-delimited word around the caret', () => {
    const s = state('one two three', 5)
    expect(caretWordRange(s)).toEqual({ from: 4, to: 7 })
  })

  it('includes the word when the caret sits at its end', () => {
    const s = state('**bold** next', 8)
    expect(caretWordRange(s)).toEqual({ from: 0, to: 8 })
  })

  it('is empty when the caret sits after a space', () => {
    const s = state('**bold** ', 9)
    expect(caretWordRange(s)).toEqual({ from: 9, to: 9 })
  })

  it('widens to cover a non-empty selection', () => {
    const s = state('one two three', 0, 7)
    expect(caretWordRange(s)).toEqual({ from: 0, to: 7 })
  })

  it('treats a finished mark on the same line as outside the word being typed', () => {
    const s = state('**bold** next', 12)
    expect(overlapsCaretWord(s, 0, 8)).toBe(false)
    expect(overlapsCaretWord(s, 10, 13)).toBe(true)
  })
})
