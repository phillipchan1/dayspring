import { describe, expect, it } from 'vitest'
import { minimalDocChange } from './minimalDocChange'

/** Apply a change the way CodeMirror would, so tests assert the real outcome. */
function apply(doc: string, change: ReturnType<typeof minimalDocChange>): string {
  if (!change) return doc
  return doc.slice(0, change.from) + change.insert + doc.slice(change.to)
}

describe('minimalDocChange', () => {
  it('returns null for identical documents', () => {
    expect(minimalDocChange('same', 'same')).toBeNull()
    expect(minimalDocChange('', '')).toBeNull()
  })

  it('narrows an edit in the middle to just that word', () => {
    const before = 'Lord, I am weary today.\n\nBut you are near.'
    const after = 'Lord, I am grateful today.\n\nBut you are near.'
    const change = minimalDocChange(before, after)!
    expect(before.slice(change.from, change.to)).toBe('weary')
    expect(change.insert).toBe('grateful')
    expect(apply(before, change)).toBe(after)
  })

  it('describes an append as a pure insertion at the end', () => {
    const before = 'first paragraph'
    const after = 'first paragraph\n\nsecond paragraph'
    const change = minimalDocChange(before, after)!
    expect(change.from).toBe(before.length)
    expect(change.to).toBe(before.length)
    expect(apply(before, change)).toBe(after)
  })

  it('describes a prepend as a pure insertion at the start', () => {
    const before = 'body'
    const after = 'title\n\nbody'
    const change = minimalDocChange(before, after)!
    expect(change.from).toBe(0)
    expect(change.to).toBe(0)
    expect(apply(before, change)).toBe(after)
  })

  it('handles a deletion', () => {
    const before = 'keep this cut that keep this too'
    const after = 'keep this keep this too'
    expect(apply(before, minimalDocChange(before, after))).toBe(after)
  })

  it('handles going to and from empty', () => {
    expect(apply('', minimalDocChange('', 'new'))).toBe('new')
    expect(apply('old', minimalDocChange('old', ''))).toBe('')
  })

  it('handles a wholly different document', () => {
    const before = 'aaa'
    const after = 'zzz'
    expect(apply(before, minimalDocChange(before, after))).toBe(after)
  })

  it('never splits a surrogate pair', () => {
    // Both emoji share a high surrogate, so a naive prefix scan stops between
    // the halves and hands back a range covering half a character.
    const before = 'joy 😀 today'
    const after = 'joy 😁 today'
    const change = minimalDocChange(before, after)!
    expect(apply(before, change)).toBe(after)
    // The replaced range covers whole characters, not a lone surrogate.
    expect(before.slice(change.from, change.to)).toBe('😀')
    expect(change.insert).toBe('😁')
  })

  it('handles an emoji appended after a shared prefix', () => {
    const before = 'praise'
    const after = 'praise 🙏'
    expect(apply(before, minimalDocChange(before, after))).toBe(after)
  })

  it('handles repeated text where prefix and suffix scans would overlap', () => {
    const before = 'aaaa'
    const after = 'aa'
    const change = minimalDocChange(before, after)!
    expect(change.to).toBeGreaterThanOrEqual(change.from)
    expect(apply(before, change)).toBe(after)
  })

  it('round-trips a spread of random edits', () => {
    const alphabet = 'ab \n'
    const rand = (seed: number) => {
      let s = seed
      return () => {
        s = (s * 1103515245 + 12345) % 2147483648
        return s / 2147483648
      }
    }
    const next = rand(42)
    for (let i = 0; i < 300; i++) {
      const make = (len: number) =>
        Array.from({ length: len }, () => alphabet[Math.floor(next() * alphabet.length)]).join('')
      const before = make(Math.floor(next() * 20))
      const after = make(Math.floor(next() * 20))
      const change = minimalDocChange(before, after)
      expect(apply(before, change)).toBe(after)
      if (change) expect(change.to).toBeGreaterThanOrEqual(change.from)
    }
  })
})
