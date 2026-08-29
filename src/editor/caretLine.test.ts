// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { caretLineRange, overlapsCaretLine } from './caretLine'

function state(doc: string, anchor: number) {
  return EditorState.create({ doc, selection: { anchor } })
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
