import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { spiritualBlocksField } from './spiritualBlocksField'
import { activeParagraph } from './dimming'

const ID = '11111111-1111-1111-1111-111111111111'
const SCRIPTURE = '```dayspring-scripture ' + ID + '\nWait for the LORD\nPsalm 27:14 · ESV\n```'
const PRAYER = '```dayspring-prayer ' + ID + '\nLord, I wait\n```'

function paragraphAt(doc: string, head: number) {
  const state = EditorState.create({
    doc,
    selection: { anchor: head },
    extensions: [spiritualBlocksField],
  })
  return activeParagraph(state)
}

describe('activeParagraph', () => {
  // The reported bug. A scripture fence is non-blank lines, so the text above a
  // verse, the verse, and the line written beneath it counted as one paragraph:
  // typing under the verse left the line above it lit.
  const doc = 'Lord i wait on you\n' + SCRIPTURE + '\nlord i wait for you.'

  it('stops at a scripture block: writing beneath it does not light the line above', () => {
    expect(paragraphAt(doc, doc.length)).toEqual({ start: 6, end: 6 })
  })

  it('stops at a scripture block from the other side too', () => {
    expect(paragraphAt(doc, 5)).toEqual({ start: 1, end: 1 })
  })

  it('treats the row beside the block like an empty line: only it is active', () => {
    expect(paragraphAt(doc, 'Lord i wait on you\n'.length)).toEqual({ start: 2, end: 2 })
  })

  it('still runs a paragraph across consecutive lines, and stops at blank ones', () => {
    const prose = 'one\ntwo\n\nthree'
    expect(paragraphAt(prose, 1)).toEqual({ start: 1, end: 2 })
    expect(paragraphAt(prose, prose.length)).toEqual({ start: 4, end: 4 })
  })

  // A prayer is the writer's own line drawn as a line, so it stays in its
  // paragraph and fades and brightens with the writing around it.
  it('does not treat a prayer block as a boundary', () => {
    const withPrayer = 'before\n' + PRAYER + '\nafter'
    expect(paragraphAt(withPrayer, withPrayer.length)).toEqual({ start: 1, end: 5 })
  })
})
