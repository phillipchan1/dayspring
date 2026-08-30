import { describe, expect, it } from 'vitest'
import {
  distanceText,
  lineAt,
  markingsNearSubject,
  mentionLines,
  type LocatableMarking,
} from './subjectJoin'

const body = [
  /* 0 */ 'woke early. the house was quiet.',
  /* 1 */ '',
  /* 2 */ 'thought about Esther all morning and what she carries.',
  /* 3 */ 'God, be near to her today.',
  /* 4 */ '',
  /* 5 */ 'later: the invoice still is not paid.',
  /* 6 */ 'Lord, give me patience with the money.',
].join('\n')

const at = (line: number, needle: string) =>
  body.split('\n').slice(0, line).join('\n').length + (line ? 1 : 0) + body.split('\n')[line]!.indexOf(needle)

const her: LocatableMarking = {
  id: 'near',
  type: 'prayer',
  content: 'God, be near to her today.',
  charStart: at(3, 'God'),
}
const money: LocatableMarking = {
  id: 'far',
  type: 'prayer',
  content: 'Lord, give me patience with the money.',
  charStart: at(6, 'Lord'),
}
const esther = /\besther\b/i

describe('lineAt', () => {
  it('counts the newlines before an offset', () => {
    expect(lineAt(body, 0)).toBe(0)
    expect(lineAt(body, at(3, 'God'))).toBe(3)
    expect(lineAt(body, at(6, 'Lord'))).toBe(6)
  })
})

describe('mentionLines', () => {
  it('finds the lines a subject is named on, without duplicates', () => {
    expect(mentionLines(body, esther)).toEqual([2])
    expect(mentionLines('Esther\nEsther and Esther', esther)).toEqual([0, 1])
  })

  it('does not mutate a caller’s regex lastIndex', () => {
    const rx = /\besther\b/gi
    rx.lastIndex = 99
    mentionLines(body, rx)
    expect(rx.lastIndex).toBe(99)
  })
})

describe('markingsNearSubject', () => {
  it('keeps a marking beside the mention and drops one down the page', () => {
    const hits = markingsNearSubject(body, esther, [her, money])
    expect(hits).toEqual([{ id: 'near', type: 'prayer', distance: 1 }])
  })

  it('returns nothing when the subject is not on the page', () => {
    expect(markingsNearSubject(body, /\bnaomi\b/i, [her, money])).toEqual([])
  })

  it('widens only as far as it is told', () => {
    expect(markingsNearSubject(body, esther, [her, money], 4).map((h) => h.id)).toEqual([
      'near',
      'far',
    ])
  })

  it('locates a declared block by its stored offset, fence and all', () => {
    // The case nearby.ts structurally cannot do: a fenced block is stripped from
    // the prose before its search runs, so every /pray was invisible to it.
    const fenced = [
      'thinking about Esther.',
      '```dayspring-pray 11111111-2222-4333-8444-555555555555',
      'God, be near to her today.',
      '```',
    ].join('\n')
    const block: LocatableMarking = {
      id: 'blk',
      type: 'prayer',
      content: 'God, be near to her today.',
      charStart: fenced.indexOf('```dayspring-pray'),
    }
    expect(markingsNearSubject(fenced, esther, [block])).toEqual([
      { id: 'blk', type: 'prayer', distance: 1 },
    ])
  })

  it('falls back to a verbatim search while offsets are still being backfilled', () => {
    const unlocated = { ...her, charStart: null }
    expect(markingsNearSubject(body, esther, [unlocated]).map((h) => h.distance)).toEqual([1])
  })

  it('refuses to place a marking whose text is no longer on the page', () => {
    // The writer edited the sentence after the harvest read it. There is no
    // honest position, so it gets none — never line zero.
    const stale = { ...her, charStart: null, content: 'a sentence long since rewritten' }
    expect(markingsNearSubject(body, esther, [stale])).toEqual([])
  })

  it('refuses a needle too short to mean anything', () => {
    const tiny = { ...her, charStart: null, content: 'quiet.' }
    expect(markingsNearSubject(body, esther, [tiny])).toEqual([])
  })
})

describe('distanceText', () => {
  it('states a fact and never a score', () => {
    expect(distanceText(0)).toBe('on the same line')
    expect(distanceText(1)).toBe('the next line')
    expect(distanceText(3)).toBe('3 lines away')
  })
})
