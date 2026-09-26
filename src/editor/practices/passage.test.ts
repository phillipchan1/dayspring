import { describe, expect, it } from 'vitest'
import {
  bodyOf,
  canWalkWithPassage,
  caughtOf,
  citedVerses,
  findPhrase,
  parseFinderQuery,
  passageLabel,
  quoteVerse,
  readPassage,
  refFromOsis,
  sizeNote,
  trimPhrase,
  versesIn,
  withCaught,
  writePassage,
} from './passage'
import { PRACTICE_BY_NAME, movementKind } from './practicesData'
import { isRitualComplete, currentMovementIndex, type RitualBlock } from './ritualPacing'

const ID = '7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44'
const JOHN = [
  { n: 4, text: 'Remain in me, and I in you.' },
  { n: 5, text: 'I am the vine. You are the branches.' },
]

describe('the passage as a read answer', () => {
  it('is the same fence /scripture writes, and reads back', () => {
    const md = writePassage({ book: 'John', chapter: 15, from: 4, to: 5 }, JOHN, ID)
    expect(md).toBe(
      '```dayspring-scripture ' + ID + '\nRemain in me, and I in you. I am the vine. You are the branches.\nJohn 15:4–5 · ESV\n```',
    )
    const p = readPassage(md)
    expect(p?.reference).toBe('John 15:4–5')
    expect(p?.ref).toEqual({ book: 'John', chapter: 15, from: 4, to: 5 })
    expect(p?.own).toBe(false)
  })

  it('keeps only the reference when read from your own Bible', () => {
    const md = writePassage({ book: 'Psalms', chapter: 23, from: null, to: null }, null, ID)
    const p = readPassage(md)
    expect(p?.reference).toBe('Psalm 23')
    expect(p?.own).toBe(true)
    expect(p?.text).toBe('')
    expect(p?.ref).toEqual({ book: 'Psalms', chapter: 23, from: null, to: null })
  })

  it('labels single verses, ranges and whole chapters', () => {
    expect(passageLabel({ book: 'John', chapter: 15, from: 5, to: 5 })).toBe('John 15:5')
    expect(passageLabel({ book: 'Psalms', chapter: 23, from: null, to: null })).toBe('Psalm 23')
    expect(versesIn({ book: 'John', chapter: 15, from: 5, to: 5 }, JOHN)).toEqual([JOHN[1]])
  })

  it('leaves a ritual begun before the finder in the plain composer', () => {
    expect(canWalkWithPassage('')).toBe(true)
    expect(canWalkWithPassage(writePassage({ book: 'John', chapter: 15, from: 4, to: 5 }, JOHN, ID))).toBe(true)
    // What Lectio's first question used to ask for: the passage, typed out.
    expect(canWalkWithPassage('Remain in me — John 15. The word was "remain".')).toBe(false)
  })
})

describe('the word that caught you', () => {
  it('opens the answer as a quote line, and comes back apart', () => {
    const a = withCaught('Remain in me', 'It keeps coming back.')
    expect(a).toBe('> Remain in me\n\nIt keeps coming back.')
    expect(caughtOf(a)).toBe('Remain in me')
    expect(bodyOf(a)).toBe('It keeps coming back.')
  })

  it('is just the quote until something is written under it', () => {
    expect(withCaught('Remain', '')).toBe('> Remain')
    expect(bodyOf('> Remain')).toBe('')
    expect(withCaught(null, 'plain')).toBe('plain')
    expect(caughtOf('An older answer with no quote')).toBeNull()
    expect(bodyOf('An older answer with no quote')).toBe('An older answer with no quote')
  })

  it('drops the punctuation a tapped word drags along', () => {
    expect(trimPhrase('“Peace! Be still!”')).toBe('Peace! Be still!')
    expect(trimPhrase('branches.')).toBe('branches')
  })

  it('stays lit by matching text, and goes dark when the passage changes', () => {
    expect(findPhrase(JOHN, 'the VINE')).toEqual({ n: 5, start: 5, end: 13 })
    expect(findPhrase([{ n: 1, text: 'The Lord is my shepherd' }], 'the vine')).toBeNull()
  })
})

describe('quoting a verse into an answer', () => {
  it('writes the words and the number, nesting the verse’s own quotes', () => {
    expect(quoteVerse('He said, “Peace! Be still!”', 39)).toBe('“He said, ‘Peace! Be still!’” (v. 39)')
    expect(citedVerses('He is not asleep. “…” (v. 39) and (v. 41)')).toEqual([39, 41])
  })
})

describe('the finder’s query', () => {
  it('reads references, including shorthand', () => {
    expect(parseFinderQuery('jn 15:4-5')).toMatchObject({ type: 'ref', chapter: 15, from: 4, to: 5 })
    expect(parseFinderQuery('ps 23')).toMatchObject({ type: 'ref', chapter: 23, from: null })
    expect(parseFinderQuery('1 cor 13')).toMatchObject({ type: 'ref', chapter: 13 })
  })

  it('opens a bare book, which /scripture refuses', () => {
    const q = parseFinderQuery('Colossians')
    expect(q.type).toBe('book')
    const john = parseFinderQuery('john')
    expect(john.type === 'book' && john.also.map((b) => b.name)).toEqual(['1 John', '2 John', '3 John'])
  })

  it('offers books for a prefix', () => {
    const q = parseFinderQuery('jo')
    expect(q.type === 'books' && q.books.map((b) => b.name)).toContain('Jonah')
  })

  it('catches a typo, and never guesses a book that is not one', () => {
    expect(parseFinderQuery('jhon 15')).toMatchObject({ type: 'typo', chapter: 15 })
    const t = parseFinderQuery('jhon 15')
    expect(t.type === 'typo' && t.book.name).toBe('John')
    expect(parseFinderQuery('hezekiah 3')).toEqual({ type: 'nobook', typed: 'hezekiah' })
    expect(parseFinderQuery('afraid')).toEqual({ type: 'topic', word: 'afraid' })
  })

  it('clamps a chapter past the end of the book', () => {
    expect(parseFinderQuery('jude 4')).toMatchObject({ type: 'ref', chapter: 1 })
  })

  it('opens a returning ref within its own chapter', () => {
    expect(refFromOsis('Rom.8.28-Rom.8.30')).toEqual({ book: 'Romans', chapter: 8, from: 28, to: 30 })
    expect(refFromOsis('Ps.23')).toEqual({ book: 'Psalms', chapter: 23, from: null, to: null })
  })
})

describe('the soft line about length', () => {
  it('describes, and says nothing when there is nothing to say', () => {
    expect(sizeNote('few', 27, 'Lectio Divina')).toMatch(/keep all 27/)
    expect(sizeNote('few', 2, 'Lectio Divina')).toBeNull()
    expect(sizeNote('story', 1, 'Discovery Bible Study')).toMatch(/whole story/)
  })
})

describe('the practices', () => {
  it('give Lectio, SOAP and Discovery a passage, and no one else', () => {
    const withPassage = [...PRACTICE_BY_NAME.values()].filter((p) => p.passage).map((p) => p.name)
    expect(withPassage.sort()).toEqual(['Discovery Bible Study', 'Lectio Divina', 'SOAP'])
  })

  it('open every scripture ritual with the passage itself', () => {
    for (const p of PRACTICE_BY_NAME.values()) {
      if (p.passage) expect(p.prompts[0]!.kind).toBe('read')
    }
  })

  it('looks a movement’s kind up by label, and only for scripture rituals', () => {
    expect(movementKind('Lectio Divina', 'Contemplatio — Rest')).toBe('dwell')
    expect(movementKind('The Daily Examen', 'Gratitude')).toBeUndefined()
  })
})

describe('rest with nothing written', () => {
  const block = (filled: boolean[]): RitualBlock => {
    const labels = PRACTICE_BY_NAME.get('Lectio Divina')!.prompts.map((p) => p.label)
    return {
      name: 'Lectio Divina',
      nameLine: 1,
      endLine: 9,
      movements: labels.map((label, index) => ({
        index,
        label,
        tokenLine: 2 + index * 2,
        answerLine: 3 + index * 2,
        contentEnd: 3 + index * 2,
        filled: filled[index]!,
      })),
    }
  }

  it('is a finished Lectio, not one waiting to be continued', () => {
    expect(isRitualComplete(block([true, true, true, false]))).toBe(true)
    expect(currentMovementIndex(block([true, false, false, false]))).toBe(1)
  })
})
