import { describe, expect, it } from 'vitest'
import { EMOTIONS } from '../keepingRead.js'
import {
  applyEmotionThresholds,
  bestThreshold,
  countsAtThreshold,
  DEFAULT_EMOTION_THRESHOLD,
  finalizeEmotions,
  fitEmotionThresholds,
  thresholdFor,
} from './sentimentThresholds.js'

describe('bestThreshold', () => {
  it('lowers the bar when recall is the miss (fear / love / shame shape)', () => {
    const labels = [
      ...Array.from({ length: 8 }, () => ({ p: 0.38, gold: true })),
      ...Array.from({ length: 20 }, () => ({ p: 0.08, gold: false })),
      { p: 0.12, gold: false },
    ]
    const row = bestThreshold(labels)
    expect(row.fitted).toBe(true)
    expect(row.threshold).toBeLessThan(0.5)
    expect(row.recall).toBeGreaterThan(0.9)
    expect(row.f1).toBeGreaterThan(0.8)
  })

  it('raises the bar when precision is the miss (longing / sadness shape)', () => {
    const labels = [
      ...Array.from({ length: 6 }, () => ({ p: 0.82, gold: true })),
      ...Array.from({ length: 10 }, () => ({ p: 0.58, gold: false })),
      ...Array.from({ length: 10 }, () => ({ p: 0.1, gold: false })),
    ]
    const row = bestThreshold(labels)
    expect(row.fitted).toBe(true)
    expect(row.threshold).toBeGreaterThan(0.5)
    expect(row.precision).toBeGreaterThan(0.8)
  })

  it('keeps the default bar when there are too few gold positives', () => {
    const labels = [
      { p: 0.9, gold: true },
      { p: 0.2, gold: false },
      { p: 0.1, gold: false },
    ]
    const row = bestThreshold(labels)
    expect(row.fitted).toBe(false)
    expect(row.threshold).toBe(DEFAULT_EMOTION_THRESHOLD)
    expect(row.positives).toBe(1)
  })
})

describe('fitEmotionThresholds', () => {
  it('fits each emotion independently and never looks at leftover ids', () => {
    const fitted = fitEmotionThresholds([
      { id: 'dev-1', gold: ['fear'], probs: { fear: 0.4, sadness: 0.62, joy: 0.05 } },
      { id: 'dev-2', gold: ['fear'], probs: { fear: 0.36, sadness: 0.61, joy: 0.04 } },
      { id: 'dev-3', gold: ['fear'], probs: { fear: 0.42, sadness: 0.1, joy: 0.02 } },
      { id: 'dev-4', gold: ['sadness'], probs: { fear: 0.05, sadness: 0.8, joy: 0.01 } },
      { id: 'dev-5', gold: [], probs: { fear: 0.08, sadness: 0.55, joy: 0.03 } },
      { id: 'dev-6', gold: [], probs: { fear: 0.07, sadness: 0.57, joy: 0.02 } },
    ])
    expect(fitted.fittedOn).toBe('dev')
    expect(fitted.nDev).toBe(6)
    expect(fitted.byEmotion.fear.fitted).toBe(true)
    expect(fitted.byEmotion.fear.threshold).toBeLessThan(0.5)
    expect(fitted.byEmotion.sadness.fitted).toBe(false) // only 1 positive
    expect(thresholdFor('joy', fitted)).toBe(DEFAULT_EMOTION_THRESHOLD)
  })

  it('apply + finalize drop denied labels and add primary as a second signal', () => {
    const fitted = fitEmotionThresholds(
      Array.from({ length: 6 }, (_, i) => ({
        id: `d${i}`,
        gold: i < 3 ? ['love'] : [],
        probs: { love: i < 3 ? 0.4 : 0.05 },
      })),
    )
    const kept = applyEmotionThresholds({ love: 0.4, anger: 0.7 }, fitted)
    expect(kept).toContain('love')
    expect(kept).toContain('anger')

    const finalized = finalizeEmotions({
      present: true,
      probs: { love: 0.4, anger: 0.7, shame: 0.2 },
      denied: ['anger'],
      primary: 'shame',
      thresholds: fitted,
    })
    expect(finalized).toContain('love')
    expect(finalized).not.toContain('anger')
    expect(finalized[0]).toBe('shame')
  })

  it('returns no emotions when present is false', () => {
    expect(
      finalizeEmotions({
        present: false,
        probs: { joy: 0.9 },
        primary: 'joy',
      }),
    ).toEqual([])
  })
})

describe('countsAtThreshold', () => {
  it('tallies a known 2x2', () => {
    expect(
      countsAtThreshold(
        [
          { p: 0.8, gold: true },
          { p: 0.2, gold: true },
          { p: 0.7, gold: false },
          { p: 0.1, gold: false },
        ],
        0.5,
      ),
    ).toEqual({ tp: 1, fp: 1, fn: 1 })
  })
})

describe('emotion set', () => {
  it('writes a row for every closed label', () => {
    const fitted = fitEmotionThresholds([])
    expect(Object.keys(fitted.byEmotion).sort()).toEqual([...EMOTIONS].sort())
  })
})
