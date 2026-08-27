import { describe, expect, it } from 'vitest'
import { chapterFromCitation, esvOrgChapter } from './citation'

describe('chapterFromCitation', () => {
  it('reads a scripture-block citation with translation', () => {
    expect(chapterFromCitation('Psalm 46:10 · ESV')).toEqual({
      book: 'Psalms',
      chapter: 46,
      verse: 10,
    })
  })

  it('reads a bare book chapter verse', () => {
    expect(chapterFromCitation('James 4:8')).toEqual({
      book: 'James',
      chapter: 4,
      verse: 8,
    })
  })

  it('returns null when there is nothing to parse', () => {
    expect(chapterFromCitation(null)).toBeNull()
    expect(chapterFromCitation('a note I wrote')).toBeNull()
  })
})

describe('esvOrgChapter', () => {
  it('builds an ESV.org chapter URL', () => {
    expect(esvOrgChapter('James', 4)).toBe('https://www.esv.org/James%204/')
  })
})
