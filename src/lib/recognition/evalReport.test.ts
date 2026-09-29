import { describe, expect, it } from 'vitest'
import { CORPUS, stratifiedSample } from './corpus'
import { costPerPass, mean, meanScore } from './evalReport'

describe('costPerPass', () => {
  it('divides accumulated spend by the rerun count', () => {
    const c = costPerPass(0.03, 1000, 3)
    expect(c.total).toBeCloseTo(0.01)
    expect(c.per1k).toBeCloseTo(0.01)
    expect(c.per2000).toBeCloseTo(0.02)
    expect(c.allPasses).toBeCloseTo(0.03)
  })
})

describe('meanScore', () => {
  it('averages F1 across reruns', () => {
    const a = { tp: 2, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 }
    const b = { tp: 0, fp: 2, fn: 0, precision: 0, recall: 1, f1: 0 }
    const m = meanScore([a, b])
    expect(m.f1).toBeCloseTo(0.5)
    expect(m.tp).toBeCloseTo(1)
  })
})

describe('mean', () => {
  it('is 0 on an empty list', () => {
    expect(mean([])).toBe(0)
  })
})

describe('stratifiedSample', () => {
  it('covers more than one category on a small N', () => {
    const picked = stratifiedSample(CORPUS, 12, (e) => e.category)
    expect(picked).toHaveLength(12)
    const cats = new Set(picked.map((e) => e.category))
    expect(cats.size).toBeGreaterThan(1)
  })

  it('returns the full list when N is larger than the corpus', () => {
    const picked = stratifiedSample(CORPUS, CORPUS.length + 10, (e) => e.category)
    expect(picked).toHaveLength(CORPUS.length)
  })
})
