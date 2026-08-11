import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import { buildSubjectIndex, matchSubjects, subjectMatcher, wordSubject } from './subjects'

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

  // AND, not OR. A second word has to mean "and also" — otherwise lighting one
  // more thing hands back a bigger pile than you started with.
  it('narrows when a second word is lit', () => {
    const hit = matchSubjects(index, [word('Chicago'), word('Naomi')])!
    expect([...hit]).toEqual([chicagoAndNaomi.id])
  })

  it('can narrow to nothing rather than forcing a match', () => {
    expect(matchSubjects(index, [word('Chicago'), word('Reykjavik')])!.size).toBe(0)
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
