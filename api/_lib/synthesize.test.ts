// Guards the validators that stand between the reflection model and the Ascent.
//
// The product rule is "grounded, or silent": every quote shown back to someone
// must be their own words, verbatim. Facts are computed in code and the model
// only selects — validateQuotes is where that is enforced. A fabricated quote
// getting through is the worst thing this app can do, because it would put
// invented words in someone's mouth about their own spiritual life and present
// them as remembered fact.
//
// So these tests are about the gate failing CLOSED, not about coverage.

import { describe, expect, it } from 'vitest'
import { validateObservation, validateQuotes, validateTopics } from './synthesize.js'

const sources = new Map([
  ['e1', [{ date: '2026-01-05', text: 'Lord, I am tired of being afraid of a day that has not happened yet.' }]],
  ['e2', [{ date: '2026-01-09', text: 'Small group tonight. Nobody said anything true about it.' }]],
])

const quote = (entry_id: string, text: string) => ({ entry_id, date: 'ignored', text })

describe('validateQuotes', () => {
  it('keeps a quote that really is a substring of its source', () => {
    expect(validateQuotes([quote('e1', 'tired of being afraid')], sources)).toEqual([
      { entry_id: 'e1', date: '2026-01-05', text: 'tired of being afraid' },
    ])
  })

  it('drops a fabricated quote', () => {
    expect(validateQuotes([quote('e1', 'I felt the Lord telling me to rest')], sources)).toEqual([])
  })

  it('drops a quote attributed to an entry that was never passed in', () => {
    expect(validateQuotes([quote('e99', 'tired of being afraid')], sources)).toEqual([])
  })

  it('takes the date from the matched source, not from the model', () => {
    // The model is allowed to select. It is not allowed to date anything —
    // a quote on the wrong day is a false memory.
    const [out] = validateQuotes([{ entry_id: 'e2', date: '1999-01-01', text: 'Small group' }], sources)
    expect(out?.date).toBe('2026-01-09')
  })

  it('collapses duplicates', () => {
    const dupes = [quote('e1', 'tired of being afraid'), quote('e1', 'tired of being afraid')]
    expect(validateQuotes(dupes, sources)).toHaveLength(1)
  })

  it('caps the result at four', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      quote('e1', 'tired of being afraid'.slice(0, 8 + i)),
    )
    expect(validateQuotes(many, sources).length).toBeLessThanOrEqual(4)
  })

  it('drops empty and whitespace-only quotes', () => {
    expect(validateQuotes([quote('e1', '   '), quote('e1', '')], sources)).toEqual([])
  })

  it('REGRESSION: is strict about whitespace, unlike the other two verbatim gates', () => {
    // There are three verbatim gates in this codebase and only TWO
    // normalization policies:
    //   altar.ts isVerbatim       — whitespace-tolerant
    //   concordance.ts isVerbatim — whitespace-tolerant
    //   validateQuotes (here)     — strict .includes
    //
    // A quote spanning a line break in the source therefore survives on the
    // Altar and is dropped from the Ascent. That asymmetry is pinned here on
    // purpose: it may well be wrong, but it should be changed deliberately,
    // not "unified" by someone tidying up who never knew it was load-bearing.
    const wrapped = new Map([['e3', [{ date: '2026-02-02', text: 'God,\n\nbe patient with me.' }]]])
    expect(validateQuotes([quote('e3', 'God, be patient with me.')], wrapped)).toEqual([])
    expect(validateQuotes([quote('e3', 'be patient with me.')], wrapped)).toHaveLength(1)
  })
})

describe('validateTopics', () => {
  const valid = new Set(['e1', 'e2'])

  it('forces the count to equal the verified id list', () => {
    // The model does not get to assert how much evidence it had.
    const [topic] = validateTopics([{ label: 'rest', count: 47, entry_ids: ['e1', 'e2'] }], valid)
    expect(topic).toEqual({ label: 'rest', count: 2, entry_ids: ['e1', 'e2'] })
  })

  it('strips invented entry ids and drops a topic left with none', () => {
    expect(validateTopics([{ label: 'rest', count: 3, entry_ids: ['nope'] }], valid)).toEqual([])
  })

  it('dedupes repeated ids rather than inflating the count', () => {
    const [topic] = validateTopics([{ label: 'rest', count: 9, entry_ids: ['e1', 'e1', 'e1'] }], valid)
    expect(topic?.count).toBe(1)
  })

  it('drops an unlabelled topic and caps at five', () => {
    expect(validateTopics([{ label: '  ', count: 1, entry_ids: ['e1'] }], valid)).toEqual([])
    const many = Array.from({ length: 8 }, (_, i) => ({
      label: `t${i}`,
      count: 1,
      entry_ids: ['e1'],
    }))
    expect(validateTopics(many, valid).length).toBeLessThanOrEqual(5)
  })
})

describe('validateObservation', () => {
  const valid = new Set(['e1', 'e2'])

  it('returns null for an empty observation so the UI hides the block', () => {
    expect(validateObservation(undefined, valid)).toBeNull()
    expect(validateObservation({ text: '   ' }, valid)).toBeNull()
  })

  it('drops evidence pointing at entries that do not exist', () => {
    const out = validateObservation(
      { text: 'You wrote about rest three times.', evidence: [{ topic: 'rest', entry_ids: ['nope'] }] },
      valid,
    )
    expect(out?.evidence ?? []).toEqual([])
  })
})
