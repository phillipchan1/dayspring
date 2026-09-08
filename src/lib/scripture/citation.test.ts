import { describe, expect, it } from 'vitest'
import {
  chapterFromCitation,
  citedVerseEdge,
  esvOrgChapter,
  formatChapterHeading,
  verseIsCited,
} from './citation'

describe('chapterFromCitation', () => {
  it('reads a scripture-block citation with translation', () => {
    expect(chapterFromCitation('Psalm 46:10 · ESV')).toEqual({
      book: 'Psalms',
      chapter: 46,
      verse: 10,
      verseEnd: null,
    })
  })

  it('reads a bare book chapter verse', () => {
    expect(chapterFromCitation('James 4:8')).toEqual({
      book: 'James',
      chapter: 4,
      verse: 8,
      verseEnd: null,
    })
  })

  it('reads Jeremiah 2:13', () => {
    expect(chapterFromCitation('Jeremiah 2:13')).toEqual({
      book: 'Jeremiah',
      chapter: 2,
      verse: 13,
      verseEnd: null,
    })
  })

  it('reads a same-chapter range', () => {
    expect(chapterFromCitation('Jeremiah 2:13-17 · ESV')).toEqual({
      book: 'Jeremiah',
      chapter: 2,
      verse: 13,
      verseEnd: 17,
    })
  })

  it('returns null when there is nothing to parse', () => {
    expect(chapterFromCitation(null)).toBeNull()
    expect(chapterFromCitation('a note I wrote')).toBeNull()
  })
})

describe('formatChapterHeading', () => {
  it('names the verse, not only the chapter', () => {
    expect(
      formatChapterHeading({ book: 'Jeremiah', chapter: 2, verse: 13, verseEnd: null }),
    ).toBe('Jeremiah 2:13')
  })

  it('collapses a range with an en dash', () => {
    expect(
      formatChapterHeading({ book: 'Jeremiah', chapter: 2, verse: 13, verseEnd: 17 }),
    ).toBe('Jeremiah 2:13–17')
  })

  it('reads Psalms in the singular', () => {
    expect(
      formatChapterHeading({ book: 'Psalms', chapter: 46, verse: 10, verseEnd: null }),
    ).toBe('Psalm 46:10')
  })

  it('falls back to the chapter when there is no verse', () => {
    expect(
      formatChapterHeading({ book: 'James', chapter: 4, verse: null, verseEnd: null }),
    ).toBe('James 4')
  })
})

describe('verseIsCited', () => {
  it('lights the opened verse', () => {
    expect(verseIsCited(13, 13, null)).toBe(true)
    expect(verseIsCited(12, 13, null)).toBe(false)
  })

  it('lights every verse in a range', () => {
    expect(verseIsCited(13, 13, 17)).toBe(true)
    expect(verseIsCited(15, 13, 17)).toBe(true)
    expect(verseIsCited(17, 13, 17)).toBe(true)
    expect(verseIsCited(18, 13, 17)).toBe(false)
  })

  it('lights nothing when the citation is a whole chapter', () => {
    expect(verseIsCited(1, null, null)).toBe(false)
  })
})

describe('citedVerseEdge', () => {
  it('marks a single verse as solo', () => {
    expect(citedVerseEdge(13, 13, null)).toBe('solo')
  })

  it('joins a range into start / mid / end', () => {
    expect(citedVerseEdge(13, 13, 17)).toBe('start')
    expect(citedVerseEdge(15, 13, 17)).toBe('mid')
    expect(citedVerseEdge(17, 13, 17)).toBe('end')
    expect(citedVerseEdge(12, 13, 17)).toBeNull()
  })
})

describe('esvOrgChapter', () => {
  it('builds an ESV.org chapter URL', () => {
    expect(esvOrgChapter('James', 4)).toBe('https://www.esv.org/James%204/')
  })
})
