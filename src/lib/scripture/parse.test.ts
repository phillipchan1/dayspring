// Guards parseReferences — the reference parser that decides what lights the
// Scripture map.
//
// This surface is client-side only: `case 'scripture'` in api/_lib/processing.ts
// is an explicit no-op, so there is no server-side pass to catch what this
// misses. Whatever the parser does to an imported entry is final.
//
// The file has three jobs, and they pull in different directions:
//
//  1. BASELINE — pin the shapes parse.ts's own header claims to handle, with
//     exact offsets and confidence, on short inline fixtures.
//  2. REGRESSION — freeze what the parser does today on the known defects,
//     using the hand-labeled corpus. These tests pass on a clean tree; they
//     exist so that fixing a defect is a visible, deliberate act rather than a
//     silent drift, and so the harm is written down next to the behavior.
//  3. FALSE POSITIVES — assert that ordinary prose yields nothing. This is the
//     non-negotiable one. A journal is mostly not about God, and the parser's
//     restraint there is what made rewriting admission safe to attempt at all.
//
// The corpus, the defect ledger and the scorer live in src/lib/recognition/.

import { describe, expect, it } from 'vitest'
import { parseReferences } from './parse'
import { CORPUS, DEFECTS, corpusFor } from '../recognition/corpus'
import type { DefectId } from '../recognition/corpus'
import { scoreOrdinaryProse, scoreScripture } from '../recognition/score'

const osis = (text: string): string[] => parseReferences(text).map((r) => r.osis_ref)

/**
 * Floors, not equalities. A frozen equality goes red the moment a defect is
 * fixed, which trains people to delete the test; a floor stays green when
 * recognition improves and fails when it regresses.
 *
 * Raise these when a defect is fixed. Never lower them.
 */
// 2026-07-31  0.62 / 0.79  first measurement
// 2026-08-01  0.73 / 0.95  fixed cross-chapter spans and reference lists
// 2026-08-01  0.80 / 1.00  replaced the capitalization guard with admits(),
//                          which reads lowercase journals AND closes the last
//                          three false positives. Recall dips slightly below the
//                          first draft of that rule on purpose — see
//                          'ambiguous-word-needs-verse'. Precision is now
//                          exactly 1: everything the parser still gets wrong, it
//                          gets wrong by staying quiet. Do not trade that away.
// 2026-08-01  0.82 / 1.00  added ordinal + short-roman forms to canon.ts, which
//                          only became a data-only fix once admits() landed
const SCRIPTURE_RECALL_FLOOR = 0.82
const SCRIPTURE_PRECISION_FLOOR = 1.0

describe('parseReferences — baseline shapes', () => {
  it('finds a book, chapter and verse', () => {
    const [ref, ...rest] = parseReferences('Sat with Phil 4:6 for a while.')
    expect(rest).toEqual([])
    expect(ref).toMatchObject({
      osis_ref: 'Phil.4.6',
      book_osis: 'Phil',
      book_name: 'Philippians',
      chapter: 4,
      verse_start: 6,
      verse_end: null,
      confidence: 1,
    })
    expect('Sat with Phil 4:6 for a while.'.slice(ref!.char_start, ref!.char_end)).toBe('Phil 4:6')
  })

  it('finds a verse range', () => {
    expect(osis('Read Romans 8:28-30 after.')).toEqual(['Rom.8.28-Rom.8.30'])
  })

  it('finds a chapter with no verse', () => {
    expect(osis('1 Cor 13 for the third week running')).toEqual(['1Cor.13'])
    expect(osis('Ps 23 in my head the whole time')).toEqual(['Ps.23'])
  })

  it('expands a verse list into one ref per landing place, sharing a span', () => {
    const refs = parseReferences('John 15:5,11 — abide, and joy.')
    expect(refs.map((r) => r.osis_ref)).toEqual(['John.15.5', 'John.15.11'])
    expect(refs[0]!.char_start).toBe(refs[1]!.char_start)
  })

  it('expands an "and" chapter continuation', () => {
    expect(osis('Psalm 42 and 43 back to back')).toEqual(['Ps.42', 'Ps.43'])
  })

  it('tolerates a trailing period on the abbreviation', () => {
    expect(osis('Gen. 1 out loud to the kids')).toEqual(['Gen.1'])
  })

  it('tolerates a "chapter" keyword and a bare verse marker', () => {
    expect(osis('Romans chapter 8 on the train')).toEqual(['Rom.8'])
    expect(osis('Rom 8 v 28 again on the way back')).toEqual(['Rom.8.28'])
  })

  it('accepts roman-numeral and spelled-out numbered books', () => {
    expect(osis('II Corinthians 5 this morning')).toEqual(['2Cor.5'])
    expect(osis('First Corinthians 13 at the wedding')).toEqual(['1Cor.13'])
    expect(osis('II Sam 12 tonight')).toEqual(['2Sam.12'])
  })

  it('covers every numbered book evenly', () => {
    // canon.ts used to list 'ii sam' but not 'ii cor', so the short roman form
    // worked for one book and not the other. All 17 numbered books now carry
    // the ordinal, short-roman and full-name variants.
    expect(osis('II Sam 12')).toEqual(['2Sam.12'])
    expect(osis('II Cor 5')).toEqual(['2Cor.5'])
    expect(osis('I Pet 5:7')).toEqual(['1Pet.5.7'])
    expect(osis('III Jn 4')).toEqual(['3John.1'])
  })
})

describe('parseReferences — clamping', () => {
  // The module's stated contract: out-of-range values are clamped with lowered
  // confidence so review can catch them, never silently discarded.
  it('clamps a chapter past the end of the book and lowers confidence', () => {
    const [ref] = parseReferences('Typed Ps 200:1 into the group chat')
    expect(ref).toMatchObject({ osis_ref: 'Ps.150.1', confidence: 0.5 })
  })

  it('clamps a single-chapter book to chapter 1', () => {
    const [ref] = parseReferences('Someone cited Jude 2:5 at me')
    expect(ref).toMatchObject({ osis_ref: 'Jude.1.5', confidence: 0.5 })
  })

  it('drops a backwards range end and keeps the start at lowered confidence', () => {
    const [ref] = parseReferences('Wrote John 3:16-2 in my notes')
    expect(ref).toMatchObject({ osis_ref: 'John.3.16', verse_end: null, confidence: 0.6 })
  })

  it('never drops a ref merely for being out of range', () => {
    expect(parseReferences('Ps 200:1')).toHaveLength(1)
  })
})

describe('parseReferences — reference-dense entries', () => {
  const dense = CORPUS.find((e) => e.id === 'scr-dense-01')!

  it('finds every reference in sermon notes, in document order', () => {
    const refs = parseReferences(dense.body)
    const starts = refs.map((r) => r.char_start)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
  })

  it('emits a repeated reference twice', () => {
    // Deduping is scan.ts's job (it upserts on entry_id + osis_ref), not the
    // parser's. Pinning the boundary keeps a future dedup bug from looking like
    // a parser bug.
    const refs = osis(dense.body)
    expect(refs.filter((r) => r === 'Isa.55.1-Isa.55.3')).toHaveLength(2)
  })
})

describe('parseReferences — ordinary prose', () => {
  // The single most important assertion in the battery. These entries are
  // seeded with book-token-plus-digit pairs ordinary English throws up by
  // accident ("am 3 chapters in", "it is 2 degrees", "that job 2 years ago").
  // They are silent only because of admits(); loosen it and this is what tells
  // you, by entry id and by the reference it invented.
  it('finds nothing in prose that is not about scripture', () => {
    const { spurious } = scoreOrdinaryProse(parseReferences)
    const readable = spurious.map((m) => `${m.entryId} → ${m.detail}`)
    expect(readable).toEqual([])
  })

  it('does not fire on a book name with no chapter number after it', () => {
    // The digit requirement is doing as much work as admits() is.
    expect(osis('Mark said the quiet part out loud')).toEqual([])
    expect(osis('Hosea texted after two years')).toEqual([])
    expect(osis('Job interview clothes still need taking in')).toEqual([])
  })
})

// ── Frozen defects ───────────────────────────────────────────────────────────
// Each of these passes today. The `refs` on the corpus entry says what should
// happen; `currentRefs` says what does. The gap is the point.

/** Every corpus entry pinning `id`, as [entryId, currentRefs] pairs. */
function frozen(id: DefectId): [string, string[]][] {
  return corpusFor('refs')
    .filter((e) => e.defect === id && e.currentRefs !== undefined)
    .map((e) => [e.id, e.currentRefs!])
}

function pin(id: DefectId, harm: string): void {
  const cases = frozen(id)
  it(`REGRESSION (${id}): ${harm}`, () => {
    for (const [entryId, current] of cases) {
      const entry = CORPUS.find((e) => e.id === entryId)!
      expect(osis(entry.body), entryId).toEqual(current)
    }
    expect(cases.length).toBeGreaterThan(0)
  })
}

describe('parseReferences — known defects, frozen', () => {
  pin('crosschapter-range', 'Romans 8-9 records only the first chapter')
  pin('bare-book-no-chapter', 'reading a whole book registers as nothing')
  it('reads the ordinal forms people actually type', () => {
    // Was a defect on two counts. The old capitalization guard read the first
    // ALPHABETIC char of the matched token — the "s" of "1st" — so adding the
    // abbr fixed nothing. admits() removed that obstacle, leaving a pure data
    // gap in canon.ts, now filled for all 17 numbered books.
    expect(osis('1st Corinthians 13 at the wedding')).toEqual(['1Cor.13'])
    expect(osis('2nd Timothy 2 this morning')).toEqual(['2Tim.2'])
    expect(osis('1st Pet 5:7')).toEqual(['1Pet.5.7'])

    // The long-standing forms still work, in any case.
    expect(osis('First Corinthians 13 at the wedding')).toEqual(['1Cor.13'])
    expect(osis('i corinthians 13 at the wedding')).toEqual(['1Cor.13'])
  })
  pin('anchorless-verse-marker', 'the verses actually dwelt on have no anchor and vanish')
  pin('allusion-undetected', 'quoted scripture with no address is invisible; no detector exists')
})

// ── Fixed defects ────────────────────────────────────────────────────────────
// Both of these used to emit a fabricated reference at confidence 1.0, which is
// the worst thing this parser can do: nothing downstream can tell a confident
// lie from a correct parse, so the map showed a verse the writer never read and
// no signal anywhere said otherwise. Kept as regression guards.

describe('parseReferences — cross-chapter verse spans', () => {
  it('keeps both ends of a span that crosses a chapter boundary', () => {
    // Was: Rom.8.2 — the trailing ":2" overwrote verseStart.
    const [ref] = parseReferences('Read Romans 8:28-9:2 in one sitting.')
    expect(ref).toMatchObject({ osis_ref: 'Rom.8.28-Rom.9.2', chapter: 8, verse_start: 28 })
  })

  it('handles spans across several chapters', () => {
    expect(osis('The Sermon on the Mount in one go — Matt 5:3-7:29.')).toEqual([
      'Matt.5.3-Matt.7.29',
    ])
    expect(osis('Ps 119:105-120:1 before work.')).toEqual(['Ps.119.105-Ps.120.1'])
  })

  it('leaves verse_end null, because the flat columns cannot express it', () => {
    // osis_ref carries the full span; verse_end would read as a verse of
    // `chapter` and render "Romans 8:28-2". Saying nothing beats saying that.
    const [ref] = parseReferences('Romans 8:28-9:2')
    expect(ref?.verse_end).toBeNull()
  })

  it('still treats a backwards range within one chapter as garbled', () => {
    const [ref] = parseReferences('Wrote John 3:16-2 in my notes')
    expect(ref).toMatchObject({ osis_ref: 'John.3.16', verse_end: null, confidence: 0.6 })
  })
})

describe('parseReferences — a measurement is not a chapter', () => {
  // Found in a real 3,048-entry archive: an imported journal whose every entry
  // ends in a weather footer. All three read as Esther 57:2 / 67:4 / 48:9, and
  // because Esther has ten chapters the clamp rounded them into Esth.10.2,
  // Esth.10.4 and Esth.10.9 — real verses, stored at status 'confirmed', which
  // is a confident lie by another route.
  it('refuses a number carrying a unit', () => {
    expect(osis('strengthen my relationship with Esther   57.2°F ☁️')).toEqual([])
    expect(osis('I will make a home for you and Esther.   67.4°F Clear')).toEqual([])
    expect(osis('taking on all 5 without Esther.  48.9°F Mostly Clear')).toEqual([])
    expect(osis('Ran the numbers again — Job 40% of the way there')).toEqual([])
  })

  it('still clamps a number someone typed AS a reference', () => {
    // The clamp is not what was wrong; rounding a temperature was.
    expect(osis('Typed Ps 200:1 into the group chat')).toEqual(['Ps.150.1'])
  })
})

describe('parseReferences — book names this writer uses for a person', () => {
  // The global AMBIGUOUS_FORMS list deliberately omits proper names, which is
  // right for a stranger and wrong for a writer whose wife is called Esther.
  // `personForms` applies the same rule to one archive.
  const hers = { personForms: ['esther'] }
  const her = (t: string) => parseReferences(t, hers).map((r) => r.osis_ref)

  it('needs a verse before a person’s name counts as scripture', () => {
    // Was: Esth.2 at confidence 1.0 — the "2" is a numbered-list index.
    expect(her('your favor 1. To make things right with Esther 2. To understand')).toEqual([])
    expect(her('dinner with Esther 3 nights running')).toEqual([])
  })

  it('still reads a real citation of the book', () => {
    expect(her('Read Esther 4:14 this morning')).toEqual(['Esth.4.14'])
    expect(her('Esther chapter 4 — for such a time as this')).toEqual(['Esth.4'])
  })

  it('changes nothing for a writer who supplies no names', () => {
    expect(osis('dinner with Esther 3 nights running')).toEqual(['Esth.3'])
  })
})

describe('parseReferences — reference lists containing a numbered book', () => {
  it('does not eat the next book’s leading digit', () => {
    // Was: ['Ps.62.5', 'Ps.62.2'] — invented a verse AND lost 2 Corinthians.
    expect(osis('Two verses for the week: Ps 62:5, 2 Cor 5:17.')).toEqual(['Ps.62.5', '2Cor.5.17'])
  })

  it('files 1 John under 1 John, not John', () => {
    expect(osis('Rom 8:28, 1 John 4:19 — both taped to the monitor now.')).toEqual([
      'Rom.8.28',
      '1John.4.19',
    ])
  })

  it('applies to "and" continuations too', () => {
    expect(osis('Read Heb 4:16 and 2 Tim 1:7 together.')).toEqual(['Heb.4.16', '2Tim.1.7'])
  })

  it('still expands an ordinary verse list', () => {
    // The lookahead must not cost us the thing the comma continuation is for.
    expect(osis('John 15:5,11 — abide, and joy.')).toEqual(['John.15.5', 'John.15.11'])
    expect(osis('Psalm 42 and 43 back to back')).toEqual(['Ps.42', 'Ps.43'])
  })

  it('is not fooled by an ordinary word that starts like a book name', () => {
    // "pe" is a tail of 1/2 Peter and "ch" of 1/2 Chronicles; neither should
    // block a continuation just because the next word happens to begin that way.
    expect(osis('John 15:5, 11 people came')).toEqual(['John.15.5', 'John.15.11'])
    expect(osis('Ps 119:105, 106 chapters in')).toEqual(['Ps.119.105', 'Ps.119.106'])
  })
})

describe('parseReferences — admission', () => {
  // This replaced a single blunt rule (the matched name had to be capitalized)
  // that was conflating two questions: is this FORM ambiguous, and is there
  // enough signal around it? The old rule cost every lowercase journal its whole
  // scripture history while still admitting "Met Mark 5 minutes late".

  it('reads a journal written in lowercase', () => {
    expect(osis('read john 3 today, first time in years')).toEqual(['John.3'])
    expect(osis('psalm 23 again')).toEqual(['Ps.23'])
    expect(osis('back in 1 cor 13 with the group')).toEqual(['1Cor.13'])
    expect(osis('notes from sunday — hebrews 11, the whole roll call')).toEqual(['Heb.11'])
    expect(osis('isaiah 43:2 came up twice today')).toEqual(['Isa.43.2'])
  })

  it('stays silent on a book name that is also an ordinary word', () => {
    // Silence is the right default for genuine ambiguity — "grounded, or silent".
    expect(osis('Met Mark 5 minutes late and he had already ordered')).toEqual([])
    expect(osis('Is 2 weeks enough notice for them?')).toEqual([])
    expect(osis('Job 2 was a slog — second interview, same panel')).toEqual([])
    expect(osis('missed the mark 3 times in a row')).toEqual([])
    expect(osis('The song 2 minutes in does the key change thing')).toEqual([])
  })

  it('admits that same word once there is a verse', () => {
    // A verse number is the strongest single signal that a word is a book.
    expect(osis('Mark 5:34 — daughter, your faith has healed you')).toEqual(['Mark.5.34'])
    expect(osis('Job 2:10 is the hardest sentence in the book')).toEqual(['Job.2.10'])
  })

  it('admits it on an explicit chapter keyword', () => {
    expect(osis('Mark chapter 5 tonight')).toEqual(['Mark.5'])
  })

  it('REGRESSION (ambiguous-word-needs-verse): a nearby reading verb is NOT enough', () => {
    // An earlier version of admits() accepted a reading verb in the same
    // sentence as evidence. It leaked, and every leak was a fabricated
    // reference — the exact failure this rule exists to prevent:
    expect(osis('Spent the morning reading Mark 5 emails from the same person.')).toEqual([])
    expect(osis('Finished reading the job 2 applications I owed them.')).toEqual([])
    expect(osis('Read the chapter on Mark 5 times before it sank in.')).toEqual([])
    expect(osis('Studying for the exam, is 2 hours enough?')).toEqual([])

    // And the price, paid knowingly: these are real references and are missed.
    expect(osis('Taught on Acts 2. Then we ate for two hours.')).toEqual([])
    expect(osis('read mark 5 before bed')).toEqual([])
  })

  it('still refuses a bare short abbreviation in lowercase', () => {
    // "ps", "rom", "gen" carry too little signal to admit uncapitalized — this
    // is the old guard, kept exactly where it earns its keep.
    expect(osis('ps 23 in my head')).toEqual([])
    expect(osis('Ps 23 in my head')).toEqual(['Ps.23'])
  })

  it('admits a numbered book in any case, because the digit is the signal', () => {
    expect(osis('back in 1 cor 13')).toEqual(['1Cor.13'])
    expect(osis('2 tim 1:7 on the wall')).toEqual(['2Tim.1.7'])
  })
})

describe('parseReferences — sentence boundaries', () => {
  it('does not read a period followed by a space as chapter:verse', () => {
    // Was: John.3.16 — the map lit the most famous verse in the Bible off a
    // headcount.
    expect(osis('Finished John 3. 16 people came to the evening thing.')).toEqual(['John.3'])
  })

  it('still reads a period with no space as chapter:verse', () => {
    expect(osis('Jn 3.16 on the wall')).toEqual(['John.3.16'])
  })

  it('still tolerates a trailing period on the book abbreviation', () => {
    expect(osis('Gen. 1 out loud to the kids')).toEqual(['Gen.1'])
  })
})

// ── Scorecard ────────────────────────────────────────────────────────────────

describe('parseReferences — scorecard', () => {
  const score = scoreScripture(parseReferences)

  it('meets the recall floor for explicit citations', () => {
    const detail = score.explicit.missedIn.join(', ')
    expect(score.explicit.recall, `missed in: ${detail}`).toBeGreaterThanOrEqual(
      SCRIPTURE_RECALL_FLOOR,
    )
  })

  it('meets the precision floor for explicit citations', () => {
    const detail = score.explicit.spuriousIn.join(', ')
    expect(score.explicit.precision, `spurious in: ${detail}`).toBeGreaterThanOrEqual(
      SCRIPTURE_PRECISION_FLOOR,
    )
  })

  it('detects no allusions at all, because no detector exists', () => {
    // status:'suggested' is in the schema and src/lib/scripture/confirm.ts can
    // promote them, but nothing in the repo ever writes one. Asserting the zero
    // keeps the dark funnel visible instead of letting it be forgotten.
    expect(score.allusions.detected).toBe(0)
    expect(score.allusions.total).toBe(DEFECTS['allusion-undetected'].entryIds.length)
  })
})
