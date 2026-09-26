import { describe, expect, it } from 'vitest'
import {
  spanText,
  findQuote,
  formatQuote,
  placeQuote,
  quotesIn,
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
  it('brings a whole verse in as a quote line', () => {
    expect(quoteVerse('He said, “Peace! Be still!”', 39)).toBe('> He said, “Peace! Be still!” (v. 39)')
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
  it('give Lectio, SOAP, Discovery and Open Reading a passage, and no one else', () => {
    const withPassage = [...PRACTICE_BY_NAME.values()].filter((p) => p.passage).map((p) => p.name)
    expect(withPassage.sort()).toEqual(['Discovery Bible Study', 'Lectio Divina', 'Open Reading', 'SOAP'])
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

describe('quotes drawn from the passage', () => {
  it('reads every quote line, with its verse', () => {
    const a = '> Remain in me (v. 4)\n\nHe says remain.\n\n> I am the vine\n\nAnd so on.'
    expect(quotesIn(a)).toEqual([
      { text: 'Remain in me', v: 4, vEnd: null, line: 0 },
      { text: 'I am the vine', v: null, vEnd: null, line: 4 },
    ])
    expect(citedVerses(a)).toEqual([4])
  })

  it('keeps the verse out of a caught word', () => {
    expect(caughtOf('> Remain in me (v. 4)\n\nbody')).toBe('Remain in me')
  })

  it('writes a quote on its own line, with a blank line each side', () => {
    const q = formatQuote('Remain in me', 4)
    expect(q).toBe('> Remain in me (v. 4)')
    // Caret at the end of a line of writing: the quote goes under it.
    const doc = 'He says remain.'
    const p = placeQuote(doc, doc.length, q)
    expect(doc.slice(0, p.at) + p.text + doc.slice(p.at)).toBe('He says remain.\n\n> Remain in me (v. 4)\n\n')
    // Caret on an empty answer: the quote is the first line.
    const e = placeQuote('', 0, q)
    expect(e.text).toBe('> Remain in me (v. 4)\n\n')
    // Caret mid-paragraph: the quote goes after that paragraph's line, not inside it.
    const mid = 'First line here.\nMore.'
    const m = placeQuote(mid, 5, q)
    expect(mid.slice(0, m.at) + m.text + mid.slice(m.at)).toBe('First line here.\n\n> Remain in me (v. 4)\n\nMore.')
  })

  it('finds a quote in its own verse first, then anywhere', () => {
    const vs = [
      { n: 4, text: 'Remain in me, and I in you.' },
      { n: 5, text: 'He who remains in me, and I in him.' },
    ]
    expect(findQuote(vs, 'and I in', 5)).toEqual([{ n: 5, start: 22, end: 30 }])
    expect(findQuote(vs, 'and I in', null)).toEqual([{ n: 4, start: 14, end: 22 }])
    expect(findQuote(vs, 'and I in', 9)?.[0]?.n).toBe(4)
    expect(findQuote(vs, 'the vine', null)).toBeNull()
  })

  it('follows a quote across a verse break', () => {
    const vs = [
      { n: 4, text: 'so neither can you, unless you remain in me.' },
      { n: 5, text: 'I am the vine. You are the branches.' },
    ]
    const q = formatQuote('unless you remain in me. I am the vine', 4, 5)
    expect(q).toBe('> unless you remain in me. I am the vine (vv. 4–5)')
    const [parsed] = quotesIn(q)
    expect(parsed).toMatchObject({ v: 4, vEnd: 5 })
    expect(findQuote(vs, parsed!.text, 4, 5)).toEqual([
      { n: 4, start: 20, end: 44 },
      { n: 5, start: 0, end: 13 },
    ])
  })

  it('snaps a selection out to whole words, across verses', () => {
    const vs = [
      { n: 4, text: 'so neither can you, unless you remain in me.' },
      { n: 5, text: 'I am the vine. You are the branches.' },
    ]
    // Started mid-"unless", ended mid-"vine".
    expect(spanText(vs, { n: 4, offset: 22 }, { n: 5, offset: 11 })).toEqual({
      text: 'unless you remain in me. I am the vine',
      v: 4,
      vEnd: 5,
    })
  })

  it('makes a whole verse a quote', () => {
    expect(quoteVerse('Remain in me, and I in you.', 4)).toBe('> Remain in me, and I in you (v. 4)')
  })
})
