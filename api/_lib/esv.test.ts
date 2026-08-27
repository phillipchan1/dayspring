import { describe, expect, it } from 'vitest'
import { chapterCacheKey, parseChapterVerses } from './esv.js'

describe('parseChapterVerses', () => {
  it('splits Crossway [n] markers into numbered verses', () => {
    const raw = '[1] Draw near to God, and he will draw near to you. [2] Cleanse your hands, you sinners.'
    expect(parseChapterVerses(raw)).toEqual([
      { n: 1, text: 'Draw near to God, and he will draw near to you.' },
      { n: 2, text: 'Cleanse your hands, you sinners.' },
    ])
  })

  it('drops preamble before the first verse marker', () => {
    const raw = 'James 4\n\n[1] What causes quarrels among you?'
    expect(parseChapterVerses(raw)).toEqual([{ n: 1, text: 'What causes quarrels among you?' }])
  })

  it('collapses newlines inside a verse', () => {
    const raw = '[1] Blessed is the man\nwho walks not in the counsel of the wicked,'
    expect(parseChapterVerses(raw)[0]).toEqual({
      n: 1,
      text: 'Blessed is the man who walks not in the counsel of the wicked,',
    })
  })

  it('handles a Psalm 119-scale chapter', () => {
    const raw = Array.from({ length: 176 }, (_, i) => `[${i + 1}] verse ${i + 1}.`).join(' ')
    const verses = parseChapterVerses(raw)
    expect(verses).toHaveLength(176)
    expect(verses[0]).toEqual({ n: 1, text: 'verse 1.' })
    expect(verses[175]).toEqual({ n: 176, text: 'verse 176.' })
  })

  it('handles a single-chapter book (Jude)', () => {
    const raw = '[1] Jude, a servant of Jesus Christ. [25] to the only God, our Savior.'
    expect(parseChapterVerses(raw).map((v) => v.n)).toEqual([1, 25])
  })

  it('returns nothing when Crossway omitted numbers', () => {
    expect(parseChapterVerses('Draw near to God, and he will draw near to you.')).toEqual([])
  })
})

describe('chapterCacheKey', () => {
  it('is distinct from a quote-blob key', () => {
    expect(chapterCacheKey('James', 4)).toBe('james 4#chapter')
    expect(chapterCacheKey('  Psalms  ', 119)).toBe('psalms 119#chapter')
  })
})
