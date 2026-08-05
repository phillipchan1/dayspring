import { describe, expect, it } from 'vitest'
import { ALL_EMOJI, DEFAULT_EMOJI, searchEmoji } from './emoji'

describe('searchEmoji', () => {
  it('returns the default set for an empty query', () => {
    expect(searchEmoji('')).toEqual(DEFAULT_EMOJI)
    expect(searchEmoji('   ')).toEqual(DEFAULT_EMOJI)
  })

  it('finds folded hands for "pray"', () => {
    const results = searchEmoji('pray')
    expect(results.some((e) => e.char === '🙏')).toBe(true)
  })

  it('finds heart emoji for "heart"', () => {
    const results = searchEmoji('heart')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((e) => e.keywords.some((k) => k.includes('heart')))).toBe(true)
  })

  it('finds sunrise for "sun"', () => {
    const results = searchEmoji('sun')
    expect(results.some((e) => e.char === '🌅' || e.char === '☀️')).toBe(true)
  })

  it('ranks exact and prefix keyword matches above substring matches', () => {
    const results = searchEmoji('smile')
    const firstIdx = results.findIndex((e) =>
      e.keywords.some((k) => k === 'smile' || k.startsWith('smile')),
    )
    const substringOnlyIdx = results.findIndex(
      (e) => !e.keywords.some((k) => k === 'smile' || k.startsWith('smile')) &&
        e.keywords.some((k) => k.includes('smile')),
    )
    if (firstIdx !== -1 && substringOnlyIdx !== -1) {
      expect(firstIdx).toBeLessThan(substringOnlyIdx)
    }
  })

  it('returns no results for gibberish', () => {
    expect(searchEmoji('zzzzznotanemoji')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchEmoji('face', 5).length).toBeLessThanOrEqual(5)
  })

  it('loads a non-trivial emoji catalog', () => {
    expect(ALL_EMOJI.length).toBeGreaterThan(1000)
  })
})
