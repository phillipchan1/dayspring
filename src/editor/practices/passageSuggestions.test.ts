import { describe, expect, it } from 'vitest'
import { BOOKS } from '@/lib/bible/canon'
import { SUGGESTIONS, SUGGESTION_THEMES, suggestionsFor } from './passageSuggestions'

describe('good places to begin', () => {
  it('names only real books and chapters', () => {
    for (const s of SUGGESTIONS) {
      const book = BOOKS.find((b) => b.name === s.ref.book)
      expect(book, s.ref.book).toBeDefined()
      expect(s.ref.chapter).toBeLessThanOrEqual(book!.chapters)
      if (s.ref.from != null) expect(s.ref.to ?? s.ref.from).toBeGreaterThanOrEqual(s.ref.from)
    }
  })

  it('keeps a short passage short, and gives every theme something', () => {
    for (const s of SUGGESTIONS.filter((x) => x.kind === 'short' && x.ref.from != null)) {
      expect((s.ref.to ?? s.ref.from!) - s.ref.from! + 1).toBeLessThanOrEqual(13)
    }
    for (const t of SUGGESTION_THEMES) {
      expect(SUGGESTIONS.some((s) => s.themes.includes(t)), t).toBe(true)
    }
  })

  it('offers stories to Discovery, short passages to Lectio, and either to Open Reading', () => {
    const day = new Date('2026-09-26T12:00:00Z')
    expect(suggestionsFor('story', null, 0, 5, day).every((s) => s.kind === 'story')).toBe(true)
    expect(suggestionsFor('few', null, 0, 5, day).every((s) => s.kind === 'short')).toBe(true)
    expect(suggestionsFor('any', 'Grief', 0, 50, day).every((s) => s.themes.includes('Grief'))).toBe(true)
  })

  it('turns to others when asked, and is the same for everyone on a day', () => {
    const day = new Date('2026-09-26T12:00:00Z')
    const a = suggestionsFor('few', null, 0, 5, day).map((s) => s.title)
    const b = suggestionsFor('few', null, 1, 5, day).map((s) => s.title)
    expect(a).not.toEqual(b)
    expect(suggestionsFor('few', null, 0, 5, day).map((s) => s.title)).toEqual(a)
  })
})
