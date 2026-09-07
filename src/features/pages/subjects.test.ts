import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import type { ConcordanceItem, ConcordanceKind } from '@/lib/concordance'
import {
  buildSubjectIndex,
  displayLabel,
  isAddressee,
  matchSubjects,
  mergeItems,
  subjectMatcher,
  withCounts,
  wordSubject,
} from './subjects'

let n = 0
function entry(body: string): Entry {
  const iso = new Date(2024, 5, 10, 12).toISOString()
  return {
    id: `e${++n}`,
    created_at: iso,
    updated_at: iso,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: 10,
    source: 'native',
    external_id: null,
  }
}

const word = (w: string) => wordSubject(w)!

describe('matchSubjects', () => {
  const chicagoAndNaomi = entry('Chicago with Naomi, the long way round')
  const chicagoOnly = entry('Chicago on my own this time')
  const neither = entry('a quiet week at home')
  const index = buildSubjectIndex([chicagoAndNaomi, chicagoOnly, neither])

  it('leaves the wall whole when nothing is lit', () => {
    expect(matchSubjects(index, [])).toBeNull()
  })

  it('lights the pages carrying one word', () => {
    expect(matchSubjects(index, [word('Chicago')]!)!.size).toBe(2)
  })

  /*
   * SUBJECTS UNION. "Mom and David" names the people you want to read about,
   * not a query for pages carrying both — and intersecting two people on a real
   * archive returns almost nothing, which reads as broken rather than accurate.
   * The narrowing lives in the markings, which intersect.
   */
  it('lights pages carrying either subject', () => {
    const hit = matchSubjects(index, [word('Chicago'), word('Naomi')])!
    expect(hit.size).toBe(2)
    expect(hit.has(chicagoAndNaomi.id)).toBe(true)
    expect(hit.has(chicagoOnly.id)).toBe(true)
  })

  it('adding a subject never returns fewer pages than it started with', () => {
    const one = matchSubjects(index, [word('Chicago')])!.size
    const two = matchSubjects(index, [word('Chicago'), word('Reykjavik')])!.size
    expect(two).toBeGreaterThanOrEqual(one)
  })

  it('still lights nothing when no subject is anywhere in the pages', () => {
    expect(matchSubjects(index, [word('Reykjavik')])!.size).toBe(0)
  })
})

describe('subjectMatcher', () => {
  it('is null when there is nothing to paint', () => {
    expect(subjectMatcher([])).toBeNull()
  })

  it('matches whole words, case-insensitively', () => {
    const re = subjectMatcher([word('Ben')])!
    expect('Ben came by'.match(re)).toHaveLength(1)
    expect('ben came by'.match(re)).toHaveLength(1)
    // The reason it isn't a substring search: on eleven years of pages, "Ben"
    // inside "benefit" and "bent" reads as noise rather than as a subject.
    expect('a benefit of being bent'.match(re)).toBeNull()
  })

  it('paints every lit word from one matcher', () => {
    const re = subjectMatcher([word('Chicago'), word('Naomi')])!
    expect('Chicago with Naomi'.match(re)).toHaveLength(2)
  })
})

describe('displayLabel', () => {
  it('leaves a properly written name alone', () => {
    expect(displayLabel('Chicago')).toBe('Chicago')
  })

  // The extractor settles on whatever spelling it saw; the pill is what the
  // writer reads back. "esther" is a defect on screen even though it matches.
  it('repairs a canonical the extractor left lowercase', () => {
    expect(displayLabel('esther')).toBe('Esther')
  })

  it('prefers a spelling the writer actually used', () => {
    expect(displayLabel('esther', ['Esther', 'Est'])).toBe('Esther')
  })

  it('repairs a shouted first syllable', () => {
    expect(displayLabel('CHristian')).toBe('Christian')
  })

  // The line this must not cross: these are how the writer writes them, and
  // title-casing them would be the defect rather than the fix.
  it('leaves acronyms and initialisms alone', () => {
    for (const acronym of ['SF', 'IHOP', 'ESV', 'REI', 'NQ']) {
      expect(displayLabel(acronym)).toBe(acronym)
    }
  })
})

describe('mergeItems', () => {
  const item = (
    id: string,
    canonical: string,
    kind: ConcordanceKind,
    occurrence_count: number,
    surface_forms: string[] = [],
    first_seen: string | null = null,
  ): ConcordanceItem => ({
    id,
    kind,
    canonical,
    surface_forms,
    descriptor: null,
    status: 'suggested',
    source: 'repetition',
    occurrence_count,
    first_seen,
    last_seen: null,
  })

  // The defect this exists for: on the real archive 52 names live under two or
  // more kinds, and two pills lighting identical pages is not fixable from the
  // UI, because keeping has no merge gesture and never will.
  it('folds one name filed under several kinds into one subject', () => {
    const merged = mergeItems([
      item('1', 'David', 'person', 42, ['Dave']),
      item('2', 'david', 'term', 4),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.label).toBe('David')
    expect(merged[0]!.terms).toContain('Dave')
    expect(merged[0]!.kind).toBe('person')
  })

  it('keeps distinct names apart', () => {
    expect(mergeItems([item('1', 'David', 'person', 4), item('2', 'Naomi', 'person', 3)])).toHaveLength(2)
  })

  // Keyed by the name, not the row id: a rebuild reissues ids, and a kept
  // subject has to survive one.
  it('keys by the name so a rebuild cannot orphan a kept subject', () => {
    const [a] = mergeItems([item('row-1', 'Naomi', 'person', 3)])
    const [b] = mergeItems([item('row-2', 'Naomi', 'person', 9)])
    expect(a!.key).toBe(b!.key)
  })

  it('carries the earliest first appearance of the group', () => {
    const merged = mergeItems([
      item('1', 'Frontier', 'org', 8, [], '2019-04-02'),
      item('2', 'frontier', 'project', 2, [], '2016-01-09'),
    ])
    expect(merged[0]!.firstSeen).toBe('2016-01-09')
  })
})

describe('withCounts', () => {
  // The reason this exists at all: `occurrence_count` is what the extraction
  // model noticed, and on the real archive it disagrees with a literal re-count
  // on 123 of the 124 subjects above five pages. The number printed beside a
  // subject has to be the number of pages that actually light.
  it('counts the pages that light, not what the extractor recorded', () => {
    const index = buildSubjectIndex([entry('Chicago again'), entry('Chicago, and then home'), entry('nowhere')])
    const [counted] = withCounts(index, [
      { key: 'c:chicago', label: 'Chicago', terms: ['Chicago'], kind: 'place' },
    ])
    expect(counted!.count).toBe(2)
  })

  it('counts nothing as nothing rather than leaving it blank', () => {
    const index = buildSubjectIndex([entry('a quiet week')])
    const [counted] = withCounts(index, [word('Reykjavik')])
    expect(counted!.count).toBe(0)
  })
})

describe('the addressee is not a subject', () => {
  const item = (canonical: string): ConcordanceItem => ({
    id: canonical,
    kind: 'person' as ConcordanceKind,
    canonical,
    surface_forms: [],
    descriptor: null,
    status: 'suggested',
    source: 'repetition',
    occurrence_count: 900,
    first_seen: null,
    last_seen: null,
  })

  // On a real archive "Jesus" lights 2,914 pages of 3,571. A subject that dims
  // nothing is not a way of looking at anything.
  it('does not offer the One the journal is addressed to', () => {
    const merged = mergeItems([item('Jesus'), item('God'), item('Holy Spirit'), item('Naomi')])
    expect(merged.map((s) => s.label)).toEqual(['Naomi'])
  })

  it('recognises the spellings a writer actually uses', () => {
    for (const name of ['god', 'Lord Jesus', 'the Holy Spirit', 'CHRIST']) {
      expect(isAddressee(name)).toBe(true)
    }
  })

  // Conservative on purpose: on a real archive "Father" is a person's actual
  // father at least as often as it is a name for God.
  it('leaves names a writer might plausibly be naming rather than addressing', () => {
    for (const name of ['Father', 'Christian', 'Grace', 'Faith']) {
      expect(isAddressee(name)).toBe(false)
    }
  })

  // Nothing is censored. The writer supplying the signal always wins.
  it('still lights the pages when the writer types it herself', () => {
    const index = buildSubjectIndex([entry('thank you Jesus'), entry('a quiet week')])
    expect(matchSubjects(index, [word('Jesus')])!.size).toBe(1)
  })
})

describe('no subject may claim another subject a name', () => {
  const item = (
    canonical: string,
    surface_forms: string[] = [],
  ): ConcordanceItem => ({
    id: canonical,
    kind: 'person' as ConcordanceKind,
    canonical,
    surface_forms,
    descriptor: null,
    status: 'suggested',
    source: 'repetition',
    occurrence_count: 5,
    first_seen: null,
    last_seen: null,
  })

  /*
   * The real defect this exists for. "Chicago" carried "church" as a surface
   * form, so choosing Chicago lit every page mentioning church — and nothing on
   * screen said so. Worse on the real archive: "Esther" carried "judy", one
   * person's subject swallowing another's pages.
   */
  it('drops a surface form that is another subject a canonical', () => {
    const merged = mergeItems([item('Chicago', ['church', 'Chicago?']), item('church')])
    const chicago = merged.find((s) => s.label === 'Chicago')!
    expect(chicago.terms).toEqual(['Chicago', 'Chicago?'])
  })

  // Nothing is lost: the claimed name is a subject in its own right.
  it('leaves the claimed subject matching under its own name', () => {
    const merged = mergeItems([item('Esther', ['judy']), item('Judy')])
    expect(merged.find((s) => s.label === 'Judy')!.terms).toContain('Judy')
    expect(merged.find((s) => s.label === 'Esther')!.terms).not.toContain('judy')
  })

  it('keeps spellings nobody else claims', () => {
    const merged = mergeItems([item('Esther', ['Est', 'esther'])])
    expect(merged[0]!.terms).toEqual(['Esther', 'Est', 'esther'])
  })

  it('never drops a subject own canonical', () => {
    const merged = mergeItems([item('Ben'), item('Ben')])
    expect(merged[0]!.terms).toContain('Ben')
  })
})
