import { describe, expect, it } from 'vitest'
import { caretBlockMoved } from './typewriter'

describe('typewriter: when typing re-centres', () => {
  const block = { from: 120, height: 28 }
  it('not for a keystroke that stays on the same row', () => {
    expect(caretBlockMoved(block, { from: 120, height: 28 })).toBe(false)
  })
  it('when the paragraph wraps onto (or back off) a row', () => {
    expect(caretBlockMoved(block, { from: 120, height: 56 })).toBe(true)
    expect(caretBlockMoved({ from: 120, height: 56 }, block)).toBe(true)
  })
  it('when the caret is in another line block (Return, a join)', () => {
    expect(caretBlockMoved(block, { from: 160, height: 28 })).toBe(true)
  })
  it('before it has ever centred', () => {
    expect(caretBlockMoved(null, block)).toBe(true)
  })
})
