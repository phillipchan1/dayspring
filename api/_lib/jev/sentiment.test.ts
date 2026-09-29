import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configureTypeSafe, resetTypeSafe } from '../typesafe.js'
import { argmaxScore, bucketValenceLevel, jevSentiment } from './sentiment.js'
import {
  answersForQuestions,
  noulNo,
  noulYes,
  parseBody,
  scoreOf,
  systemOneResponse,
} from './mockFetch.js'

describe('bucketValenceLevel / argmaxScore', () => {
  it('maps 0–1 to negative, 2 to mixed, 3–4 to positive', () => {
    expect(bucketValenceLevel(0)).toBe('negative')
    expect(bucketValenceLevel(1)).toBe('negative')
    expect(bucketValenceLevel(2)).toBe('mixed')
    expect(bucketValenceLevel(3)).toBe('positive')
    expect(bucketValenceLevel(4)).toBe('positive')
  })

  it('picks the argmax level even when the expected value sits in mixed', () => {
    const a = argmaxScore(
      { score: 2.38, probabilities: { '3': 0.48, '2': 0.42, '1': 0.1, '0': 0, '4': 0 } },
      2,
    )
    expect(a.level).toBe(3)
    expect(a.p).toBeCloseTo(0.48)
    expect(a.expected).toBeCloseTo(2.38)
    expect(bucketValenceLevel(a.level)).toBe('positive')
  })
})

describe('jevSentiment', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key'
  })
  afterEach(() => {
    resetTypeSafe()
    delete process.env.TYPESAFE_API_KEY
  })

  it('buckets a clearly pleasant page on argmax, not the weighted average', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'present') return noulYes(0.96)
            if (id === 'valence') {
              return scoreOf(2.38, 0.7, { '3': 0.48, '2': 0.42, '1': 0.1, '0': 0, '4': 0 })
            }
            if (id === 'activation') return scoreOf(1.0, 0.9, { '1': 0.9, '0': 0.05, '2': 0.05 })
            if (id === 'emo_joy') return noulYes(0.88)
            if (type === 'noul') return noulNo(0.05)
            return scoreOf(2, 0.5)
          }),
        )
      },
    })
    const reading = await jevSentiment('I felt glad walking home.')
    expect(reading.valenceBucket).toBe('positive')
    expect(reading.valenceExpected).toBeCloseTo((2.38 / 4) * 2 - 1)
    expect(reading.valenceLevel).toBe(3)
    expect(reading.confidence).toBeCloseTo(0.48)
  })
})
