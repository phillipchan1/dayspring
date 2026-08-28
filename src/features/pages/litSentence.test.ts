import { describe, expect, it } from 'vitest'
import { litSentence } from './litSentence'

const say = (over: Partial<Parameters<typeof litSentence>[0]> = {}) =>
  litSentence({ count: 34, subjects: [], markings: [], ...over })

describe('litSentence', () => {
  it('is a bare count when nothing is lit', () => {
    expect(say({ count: 2969 })).toBe('2,969 pages')
    expect(say({ count: 1 })).toBe('1 page')
  })

  it('names the subject', () => {
    expect(say({ subjects: ['Tiffany'] })).toBe('34 pages saying Tiffany')
  })

  /*
   * The defect this module exists for. Choosing a subject AND a marking
   * narrowed the wall and the sentence named only the subject, so the one place
   * the surface states its filter was wrong about it.
   */
  it('names the markings too, which is the whole point', () => {
    expect(say({ subjects: ['Tiffany'], markings: ['scripture'] })).toBe(
      '34 pages saying Tiffany and marked Scripture',
    )
    expect(say({ markings: ['prayer'] })).toBe('34 pages marked Prayer')
  })

  // Subjects UNION and markings INTERSECT (see matchSubjects / matchFacets), so
  // the sentence cannot use one joiner for both without lying about one of them.
  it('joins subjects with or, and markings with and', () => {
    expect(say({ subjects: ['Mom', 'David'] })).toBe('34 pages saying Mom or David')
    expect(say({ markings: ['prayer', 'scripture'] })).toBe('34 pages marked Prayer and Scripture')
  })

  it('handles three of a kind without a stray comma', () => {
    expect(say({ subjects: ['Mom', 'David', 'Naomi' ] })).toBe(
      '34 pages saying Mom, David or Naomi',
    )
  })

  it('carries a question, which has no word to light', () => {
    expect(say({ question: 'where did I feel far from God', markings: ['prayer'] })).toBe(
      '34 pages matching “where did I feel far from God” and marked Prayer',
    )
  })

  // Retired kinds still draw on pages that carry them, so the label table has
  // to be the one storage reads rather than the one the pills offer.
  it('labels a retired kind rather than printing its raw key', () => {
    expect(say({ markings: ['gift'] })).toBe('34 pages marked Gift')
  })
})
