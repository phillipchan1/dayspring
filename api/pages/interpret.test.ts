// The model is allowed to suggest and never to decide. `sanitize` is where that
// stops being a promise and becomes code: anything it doesn't recognise becomes
// nothing, because a filter the writer can't see and can't remove is worse than
// a filter that never appeared.

import { describe, expect, it } from 'vitest'
import { sanitize } from './interpret.js'

describe('sanitize', () => {
  it('is empty for nothing at all', () => {
    expect(sanitize(null)).toEqual({
      terms: [],
      facets: [],
      months: [],
      from: null,
      to: null,
      arrange: 'date',
    })
  })

  it('keeps the terms it was given', () => {
    expect(sanitize({ terms: ['Chicago', 'Chi-town'] }).terms).toEqual(['Chicago', 'Chi-town'])
  })

  // Same floor subjects.ts uses. Below it a term lights half the archive, which
  // reads as a broken filter rather than an answer.
  it('drops a term too short to mean anything', () => {
    expect(sanitize({ terms: ['a', 'I', 'Chicago', ''] }).terms).toEqual(['Chicago'])
  })

  it('caps how many words one sentence can light', () => {
    const many = Array.from({ length: 20 }, (_, i) => `term${i}`)
    expect(sanitize({ terms: many }).terms).toHaveLength(6)
  })

  it('drops a facet the wall cannot apply', () => {
    const r = sanitize({ facets: ['highlight', 'vibes', 'highlight:rose', 'sentiment'] })
    expect(r.facets).toEqual(['highlight', 'highlight:rose'])
  })

  it('does not repeat a facet', () => {
    expect(sanitize({ facets: ['highlight', 'highlight'] }).facets).toEqual(['highlight'])
  })

  it('accepts only real calendar months', () => {
    expect(sanitize({ months: [0, 11, 12, -1, 5.5] }).months).toEqual([0, 11])
  })

  it('accepts only dates it can parse', () => {
    expect(sanitize({ from: '2019-03-01', to: 'last summer' })).toMatchObject({
      from: '2019-03-01',
      to: null,
    })
  })

  // Ordering by date is the fallback the writer can always get back to, so an
  // arrangement nobody implements has to land there rather than anywhere else.
  it('falls back to date for an arrangement it does not know', () => {
    expect(sanitize({ arrange: 'by-vibes' as never }).arrange).toBe('date')
    expect(sanitize({ arrange: 'by-year' }).arrange).toBe('by-year')
  })

  it('survives fields of entirely the wrong type', () => {
    const r = sanitize({
      terms: 'Chicago' as never,
      facets: 42 as never,
      months: null as never,
    })
    expect(r).toEqual({ terms: [], facets: [], months: [], from: null, to: null, arrange: 'date' })
  })
})
