import { describe, expect, it } from 'vitest'
import type { PageMarking } from '@/lib/spiritual'
import type { Entry, SpiritualItemType } from '@/lib/types'
import { subjectMatcher, wordSubject } from './subjects'
import { distanceText, markingsNear } from './nearby'

function entry(id: string, dayOfMonth: number, lines: string[]): Entry {
  const iso = new Date(2026, 0, dayOfMonth, 9).toISOString()
  return {
    id, created_at: iso, updated_at: iso, body_markdown: lines.join('\n\n'),
    title: null, mood: null, tags: [], word_count: 40, source: 'native', external_id: null,
  }
}
let n = 0
function marking(entryId: string, content: string, type: SpiritualItemType = 'scripture'): PageMarking {
  return { id: `m${++n}`, entryId, type, content, declared: false }
}
function matcherFor(word: string): RegExp {
  const s = wordSubject(word)
  const m = s ? subjectMatcher([s]) : null
  if (!m) throw new Error('no matcher')
  return m
}

const TIFFANY = matcherFor('Tiffany')

describe('markingsNear', () => {
  it('finds a verse on the same line as the mention', () => {
    const e = entry('a', 3, ['Tiffany called, and I kept coming back to Psalm 121 all afternoon.'])
    const m = marking('a', 'Tiffany called, and I kept coming back to Psalm 121 all afternoon.')
    const near = markingsNear([e], [m], TIFFANY)
    expect(near).toHaveLength(1)
    expect(near[0]!.distance).toBe(0)
  })

  it('finds one a couple of lines below the mention', () => {
    const e = entry('a', 3, [
      'Long call with Tiffany about the move.',
      'Made tea afterwards and sat with it.',
      'I keep returning to the line about lifting my eyes to the hills.',
    ])
    const m = marking('a', 'I keep returning to the line about lifting my eyes to the hills.')
    expect(markingsNear([e], [m], TIFFANY)[0]!.distance).toBe(2)
  })

  /*
   * The whole point of a distance rather than a page. "Both true somewhere on
   * this page" is the answer that felt like nothing.
   */
  it('drops one that is on the page but nowhere near the mention', () => {
    const far = Array.from({ length: 9 }, (_, i) => `An ordinary paragraph, number ${i}, about the week.`)
    const e = entry('a', 3, [
      'Tiffany called about the move.',
      ...far,
      'I keep returning to the line about lifting my eyes to the hills.',
    ])
    const m = marking('a', 'I keep returning to the line about lifting my eyes to the hills.')
    expect(markingsNear([e], [m], TIFFANY)).toHaveLength(0)
  })

  it('measures from the NEAREST mention when a page has several', () => {
    const e = entry('a', 3, [
      'Tiffany called about the move.',
      'A paragraph in between, about nothing much at all.',
      'A second paragraph in between, equally unremarkable.',
      'A third, so the first mention is well out of range now.',
      'Tiffany again, at the end of the day.',
      'I keep returning to the line about lifting my eyes to the hills.',
    ])
    const m = marking('a', 'I keep returning to the line about lifting my eyes to the hills.')
    expect(markingsNear([e], [m], TIFFANY)[0]!.distance).toBe(1)
  })

  it('ignores a page that never names the subject', () => {
    const e = entry('a', 3, ['Nothing here about anyone, and Psalm 121 stayed with me anyway.'])
    expect(markingsNear([e], [marking('a', 'Nothing here about anyone, and Psalm 121 stayed with me anyway.')], TIFFANY)).toHaveLength(0)
  })

  /*
   * A declared block is stripped from the prose, so it has no line and no
   * distance. Calling it "near" would be the app asserting a connection nobody
   * made — the page still carries it, and opening the page still shows it.
   */
  it('leaves a marking the prose does not contain out of the reading', () => {
    const e = entry('a', 3, ['Tiffany called about the move.'])
    expect(markingsNear([e], [marking('a', 'For my father, that he would sleep tonight.')], TIFFANY)).toHaveLength(0)
  })

  /*
   * Order is the order she wrote them. Sorting by closeness would be the app
   * deciding which of her verses matter most about a person — selection is
   * significance, and significance is a verdict (D-016).
   */
  it('returns them oldest first, never by how near they were', () => {
    const older = entry('a', 3, ['A paragraph first.', 'Tiffany called.', 'A verse I held onto that day.'])
    const newer = entry('b', 20, ['Tiffany rang, and the psalm about the hills again.'])
    const near = markingsNear(
      [newer, older],
      [marking('a', 'A verse I held onto that day.'), marking('b', 'Tiffany rang, and the psalm about the hills again.')],
      TIFFANY,
    )
    expect(near.map((x) => x.entry.id)).toEqual(['a', 'b'])
    // ...even though the newer one is nearer.
    expect(near[0]!.distance).toBeGreaterThan(near[1]!.distance)
  })

  it('returns nothing at all with no subject to be near', () => {
    const e = entry('a', 3, ['Tiffany called about the move.'])
    expect(markingsNear([e], [marking('a', 'Tiffany called about the move.')], null)).toEqual([])
  })
})

describe('distanceText', () => {
  it('states the distance rather than scoring it', () => {
    expect(distanceText(0)).toBe('on the same line')
    expect(distanceText(1)).toBe('the next line')
    expect(distanceText(3)).toBe('3 lines away')
  })
})
