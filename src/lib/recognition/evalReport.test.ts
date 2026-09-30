import { describe, expect, it } from 'vitest'
import { CORPUS, stratifiedSample } from './corpus'
import {
  breakdownByTaskAndModel,
  costPerPass,
  dollarsForCall,
  dollarsForCalls,
  mean,
  meanScore,
  taskOf,
} from './evalReport'

describe('costPerPass', () => {
  it('divides accumulated spend by the rerun count', () => {
    const c = costPerPass(0.03, 1000, 3)
    expect(c.total).toBeCloseTo(0.01)
    expect(c.per1k).toBeCloseTo(0.01)
    expect(c.perItem).toBeCloseTo(0.00001)
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

describe('dollarsForCall', () => {
  const luna = { inn: 0.1, out: 0.5, cached: 0.01 }

  it('does not add reasoning on top of output_tokens', () => {
    const withReason = dollarsForCall(
      { name: 'altar_harvest', model: 'gpt-6-luna', in: 1000, cached: 0, out: 200, reasoning: 50, ms: 0 },
      luna,
    )
    const without = dollarsForCall(
      { name: 'altar_harvest', model: 'gpt-6-luna', in: 1000, cached: 0, out: 200, reasoning: 0, ms: 0 },
      luna,
    )
    expect(withReason).toBeCloseTo(without)
    expect(withReason).toBeCloseTo((1000 * 0.1 + 200 * 0.5) / 1_000_000)
  })

  it('bills cached input at the cached rate', () => {
    const d = dollarsForCall(
      { name: 'altar_harvest', model: 'gpt-6-luna', in: 1000, cached: 400, out: 0, reasoning: 0, ms: 0 },
      luna,
    )
    expect(d).toBeCloseTo((600 * 0.1 + 400 * 0.01) / 1_000_000)
  })
})

describe('taskOf / breakdown', () => {
  it('labels entity extraction separately from harvest', () => {
    expect(taskOf('concordance_extract')).toBe('entities')
    expect(taskOf('altar_harvest')).toBe('harvest')
    expect(taskOf('embed')).toBe('embed')
    expect(taskOf('jev_sentiment_denial')).toBe('sentiment')
  })

  it('prices each call by its own model and can exclude entities', () => {
    const rates = (model: string) =>
      model.startsWith('jev') ? { inn: 0.042, out: 0, cached: 0 } : { inn: 0.1, out: 0.5, cached: 0.01 }
    const calls = [
      { name: 'jev_harvest_gate:a', model: 'jev-1.13.0', in: 1_000_000, cached: 0, out: 0, reasoning: 0, ms: 0 },
      { name: 'altar_harvest', model: 'gpt-6-luna', in: 1_000_000, cached: 0, out: 0, reasoning: 0, ms: 0 },
      { name: 'concordance_extract', model: 'gpt-6-luna', in: 1_000_000, cached: 0, out: 0, reasoning: 0, ms: 0 },
    ]
    expect(dollarsForCalls(calls, rates)).toBeCloseTo(0.042 + 0.1 + 0.1)
    expect(dollarsForCalls(calls, rates, { exclude: ['entities'] })).toBeCloseTo(0.042 + 0.1)
    const rows = breakdownByTaskAndModel(calls, rates)
    expect(rows.find((r) => r.task === 'harvest' && r.model.startsWith('jev'))?.dollars).toBeCloseTo(0.042)
    expect(rows.find((r) => r.task === 'harvest' && r.model.includes('luna'))?.dollars).toBeCloseTo(0.1)
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
