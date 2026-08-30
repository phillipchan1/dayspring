import { describe, expect, it } from 'vitest'
import type { ConcordanceItem } from '@/lib/concordance'
import {
  measureJoin,
  measureMarkings,
  measureVocabulary,
  subjectMatcher,
  type BenchMarking,
} from './measure'

const conc = (over: Partial<ConcordanceItem>): ConcordanceItem => ({
  id: over.canonical ?? 'x',
  kind: 'person',
  canonical: 'x',
  surface_forms: [],
  descriptor: null,
  status: 'suggested',
  source: 'repetition',
  occurrence_count: 3,
  first_seen: null,
  last_seen: null,
  ...over,
})

const mark = (over: Partial<BenchMarking>): BenchMarking => ({
  id: 'm',
  type: 'prayer',
  content: 'God, be near to her today.',
  charStart: null,
  entryId: 'e1',
  source: 'scanned',
  ...over,
})

describe('measureMarkings', () => {
  const bodies = new Map([['e1', 'about Esther.\nGod, be near to her today.']])

  it('separates what is placed, what is findable, and what is neither', () => {
    const r = measureMarkings(
      [
        mark({ id: 'a', charStart: 14 }),
        mark({ id: 'b' }),
        mark({ id: 'c', content: 'gone now' }),
        mark({ id: 'd', entryId: null }),
      ],
      bodies,
    )
    expect(r).toMatchObject({ total: 4, located: 1, findable: 1, unplaceable: 1, orphaned: 1 })
  })

  it('counts a null source as editor-written, because rows predate the default', () => {
    const r = measureMarkings([mark({ source: null }), mark({ source: 'command' })], bodies)
    expect(r).toMatchObject({ declared: 2, scanned: 0 })
  })
})

describe('measureVocabulary', () => {
  it('reports how much of the subject space names alone cannot reach', () => {
    const r = measureVocabulary(
      [conc({ canonical: 'Esther' }), conc({ canonical: 'Chicago', kind: 'place' })],
      [
        { label: 'Esther', kind: 'person', weight: 120 },
        { label: 'spiritual dryness', kind: 'theme', weight: 166 },
        { label: 'accountability', kind: 'theme', weight: 9 },
      ],
    )
    expect(r).toMatchObject({ names: 2, matters: 3, mattersOnly: 2 })
    expect(r.shared).toEqual(['esther'])
  })

  it('catches one name filed under two kinds', () => {
    const r = measureVocabulary(
      [conc({ canonical: 'Jesus', kind: 'person' }), conc({ canonical: 'Jesus', kind: 'term' })],
      [],
    )
    expect(r.kindSplits).toEqual([{ canonical: 'jesus', kinds: ['person', 'term'] }])
  })

  it('catches a pronoun sitting in a subject’s spellings', () => {
    // The real defect: `esther` had absorbed both `her` and `Him`, which lights
    // every page in the archive.
    const r = measureVocabulary([conc({ canonical: 'esther', surface_forms: ['esther.', 'her', 'Him'] })], [])
    expect(r.pronounForms).toEqual([{ canonical: 'esther', forms: ['her', 'Him'] }])
  })
})

describe('measureJoin', () => {
  const bodies = new Map([
    ['e1', ['thinking about Esther today.', 'God, be near to her.', '', '', '', 'unrelated money worry.'].join('\n')],
    ['e2', 'nothing about anyone here.'],
  ])
  const byEntry = new Map([
    [
      'e1',
      [
        mark({ id: 'near', content: 'God, be near to her.', charStart: 29 }),
        mark({ id: 'far', content: 'unrelated money worry.', charStart: 53 }),
      ],
    ],
  ])

  it('shows what the join discriminates against page-level co-occurrence', () => {
    const r = measureJoin(bodies, byEntry, subjectMatcher('Esther'), 3)
    expect(r).toMatchObject({ pages: 1, onPage: 2, near: 1 })
    expect(r.histogram[1]).toBe(1)
    expect(r.byKind).toEqual([{ kind: 'prayer', count: 1 }])
  })

  it('widening admits the rest, which is the number worth arguing about', () => {
    expect(measureJoin(bodies, byEntry, subjectMatcher('Esther'), 5).near).toBe(2)
  })

  it('counts no page for a subject nobody wrote about', () => {
    expect(measureJoin(bodies, byEntry, subjectMatcher('Naomi'), 3)).toMatchObject({
      pages: 0,
      near: 0,
    })
  })
})

describe('subjectMatcher', () => {
  it('is whole-word and case-insensitive', () => {
    expect('with Esther today'.match(subjectMatcher('esther'))).toHaveLength(1)
    expect('Estherton Road'.match(subjectMatcher('esther'))).toBeNull()
  })

  it('escapes a subject with punctuation in its name', () => {
    expect(() => subjectMatcher('St. John (the elder)')).not.toThrow()
  })
})
