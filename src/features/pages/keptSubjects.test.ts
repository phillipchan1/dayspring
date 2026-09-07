import { describe, expect, it } from 'vitest'
import { partitionKept, withVocabulary, type KeptSubject } from './keptSubjects'
import type { Subject } from './subjects'

const subject = (key: string, label: string, terms: string[]): Subject => ({
  key,
  label,
  terms,
  kind: 'person',
})

const kept = (key: string, label: string, terms: string[], keptAt: string): KeptSubject => ({
  ...subject(key, label, terms),
  keptAt,
})

describe('withVocabulary', () => {
  // The snapshot is a floor, never a ceiling: a nickname the writer starts
  // using next year has to light, or the kept subject quietly goes blind.
  it('picks up spellings the Concordance learned after the subject was kept', () => {
    const [merged] = withVocabulary(
      [kept('c:esther', 'Esther', ['Esther'], '2026-01-01T00:00:00Z')],
      [subject('c:esther', 'Esther', ['Esther', 'Est'])],
    )
    expect(merged!.terms).toEqual(['Esther', 'Est'])
  })

  // The other direction: a rebuild that loses the row must never stop a kept
  // subject from matching, which is the whole reason terms are stored.
  it('keeps matching when the Concordance no longer has the name', () => {
    const [merged] = withVocabulary(
      [kept('c:naomi', 'Naomi', ['Naomi', 'Nomi'], '2026-01-01T00:00:00Z')],
      [],
    )
    expect(merged!.terms).toEqual(['Naomi', 'Nomi'])
  })

  // A list of the people someone carries must not re-spell itself underneath
  // them because a derived table changed its mind.
  it('leaves the label exactly as it was kept', () => {
    const [merged] = withVocabulary(
      [kept('c:mom', 'Mom', ['Mom'], '2026-01-01T00:00:00Z')],
      [subject('c:mom', 'Mother', ['Mom', 'Mother'])],
    )
    expect(merged!.label).toBe('Mom')
  })

  it('does not duplicate a spelling both sides already know', () => {
    const [merged] = withVocabulary(
      [kept('c:ben', 'Ben', ['Ben'], '2026-01-01T00:00:00Z')],
      [subject('c:ben', 'Ben', ['Ben'])],
    )
    expect(merged!.terms).toEqual(['Ben'])
  })
})

describe('partitionKept', () => {
  it('takes what is kept out of what is offered', () => {
    const vocabulary = [
      subject('c:esther', 'Esther', ['Esther']),
      subject('c:ben', 'Ben', ['Ben']),
    ]
    const { kept: held, offered } = partitionKept(vocabulary, [
      kept('c:ben', 'Ben', ['Ben'], '2026-01-01T00:00:00Z'),
    ])
    expect(held.map((k) => k.key)).toEqual(['c:ben'])
    expect(offered.map((s) => s.key)).toEqual(['c:esther'])
  })

  it('offers everything when nothing is kept', () => {
    const vocabulary = [subject('c:esther', 'Esther', ['Esther'])]
    expect(partitionKept(vocabulary, []).offered).toHaveLength(1)
  })
})
