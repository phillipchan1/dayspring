import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configureTypeSafe, resetTypeSafe } from '../typesafe.js'
import {
  argmaxScore,
  buildDenialQuestions,
  buildSentimentQuestions,
  bucketValenceLevel,
  estimateSentimentTokens,
  formatSentimentVariant,
  jevSentiment,
  parseSentimentVariant,
  SENTIMENT_RULES_TIGHT,
  SENTIMENT_RULES_WRITER,
  sentimentState,
} from './sentiment.js'
import {
  answersForQuestions,
  choiceOf,
  noulNo,
  noulYes,
  parseBody,
  scoreOf,
  systemOneResponse,
} from './mockFetch.js'
import { emptyFittedThresholds } from './sentimentThresholds.js'

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

describe('parseSentimentVariant', () => {
  it('defaults to baseline', () => {
    expect(parseSentimentVariant()).toMatchObject({
      wording: 'baseline',
      denial: false,
      thresholds: false,
      writerOnly: false,
      primary: false,
    })
  })

  it('composes tokens and expands v2', () => {
    expect(parseSentimentVariant('tight+denial')).toMatchObject({
      wording: 'tight',
      denial: true,
      thresholds: false,
    })
    expect(parseSentimentVariant('v2')).toMatchObject({
      wording: 'tight',
      denial: true,
      thresholds: true,
      writerOnly: true,
      primary: true,
    })
    expect(formatSentimentVariant(parseSentimentVariant('tight,writer,primary'))).toBe(
      'tight+writer+primary',
    )
  })

  it('rejects unknown tokens', () => {
    expect(() => parseSentimentVariant('tight+magic')).toThrow(/unknown token/)
  })
})

describe('question wording', () => {
  it('tight questions carry short definitions and explicit exclusions', () => {
    const q = buildSentimentQuestions(parseSentimentVariant('tight'))
    const blob = JSON.stringify(q)
    expect(blob).toContain('Definition:')
    expect(blob).toContain("I'm not")
    expect(blob).toContain('someone else')
    expect(blob).toMatch(/mention/i)
    expect(blob).not.toContain('primary')
    const state = sentimentState('I am not angry.', parseSentimentVariant('tight'))
    expect(state.rules).toBe(SENTIMENT_RULES_TIGHT)
    expect(state.rules).toMatch(/negation or denial/)
  })

  it('writer-only asks about the writer\'s own first-person emotion and forbids inference', () => {
    const v = parseSentimentVariant('tight+writer')
    const blob = JSON.stringify(buildSentimentQuestions(v))
    expect(blob).toMatch(/first person/i)
    expect(blob).toMatch(/Do not infer/)
    expect(sentimentState('x', v).rules).toContain(SENTIMENT_RULES_WRITER)
  })

  it('primary adds a multi-choice question; denial questions are a separate yes/no', () => {
    const q = buildSentimentQuestions(parseSentimentVariant('primary'))
    expect(JSON.stringify(q.primary)).toMatch(/PRIMARY/)
    expect(JSON.stringify(q.primary)).toContain('none')
    const deny = buildDenialQuestions(['anger', 'fear'])
    expect(JSON.stringify(deny.deny_anger)).toMatch(/denying or negating feeling anger/)
    expect(Object.keys(deny)).toEqual(['deny_anger', 'deny_fear'])
  })

  it('estimates more tokens when denial is on', () => {
    const text = 'I am not angry. I am just tired.'
    expect(estimateSentimentTokens(text, parseSentimentVariant('tight+denial'))).toBeGreaterThan(
      estimateSentimentTokens(text, parseSentimentVariant('tight')),
    )
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
    expect(reading.denied).toEqual([])
    expect(reading.variant).toBe('baseline')
  })

  it('drops a detected emotion when the denial Noul says yes', async () => {
    const names: string[] = []
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        const ids = Object.keys(req.questions)
        names.push(ids.includes('deny_anger') ? 'denial' : 'main')
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'present') return noulYes(0.9)
            if (id === 'valence') return scoreOf(1.0, 0.9, { '1': 0.85, '0': 0.1, '2': 0.05 })
            if (id === 'activation') return scoreOf(1.2, 0.8, { '1': 0.8, '2': 0.15, '0': 0.05 })
            if (id === 'emo_anger') return noulYes(0.84)
            if (id === 'deny_anger') return noulYes(0.91)
            if (type === 'noul') return noulNo(0.05)
            return scoreOf(2, 0.5)
          }),
        )
      },
    })
    const reading = await jevSentiment("I'm not angry.", { variant: 'denial' })
    expect(names).toEqual(['main', 'denial'])
    expect(reading.denied).toEqual(['anger'])
    expect(reading.emotions).not.toContain('anger')
    expect(reading.probs.emotions.anger).toBeCloseTo(0.84)
  })

  it('keeps the emotion when the denial Noul says no', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'present') return noulYes(0.9)
            if (id === 'valence') return scoreOf(1.0, 0.9, { '1': 0.85, '0': 0.1, '2': 0.05 })
            if (id === 'activation') return scoreOf(1.2, 0.8, { '1': 0.8, '2': 0.15, '0': 0.05 })
            if (id === 'emo_anger') return noulYes(0.84)
            if (id === 'deny_anger') return noulNo(0.08)
            if (type === 'noul') return noulNo(0.05)
            return scoreOf(2, 0.5)
          }),
        )
      },
    })
    const reading = await jevSentiment('I am angry about the call.', { variant: 'denial' })
    expect(reading.denied).toEqual([])
    expect(reading.emotions).toContain('anger')
  })

  it('uses the primary-emotion choice as a second signal', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'present') return noulYes(0.88)
            if (id === 'valence') return scoreOf(1.2, 0.8, { '1': 0.7, '2': 0.2, '0': 0.1 })
            if (id === 'activation') return scoreOf(1.4, 0.75, { '1': 0.7, '2': 0.25, '0': 0.05 })
            if (id === 'primary') return choiceOf('shame', 0.72)
            if (id === 'emo_stress') return noulYes(0.7)
            if (type === 'noul') return noulNo(0.12)
            return scoreOf(2, 0.5)
          }),
        )
      },
    })
    const reading = await jevSentiment('I wanted to disappear after I said it.', { variant: 'primary' })
    expect(reading.primary).toBe('shame')
    expect(reading.emotions[0]).toBe('shame')
    expect(reading.emotions).toContain('stress')
  })

  it('applies a supplied per-emotion threshold instead of the shared 0.5 bar', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'present') return noulYes(0.9)
            if (id === 'valence') return scoreOf(1.0, 0.85, { '1': 0.8, '0': 0.15, '2': 0.05 })
            if (id === 'activation') return scoreOf(1.0, 0.8, { '1': 0.8, '2': 0.1, '0': 0.1 })
            if (id === 'emo_fear') return noulYes(0.4)
            if (id === 'emo_longing') return noulYes(0.58)
            if (type === 'noul') return noulNo(0.04)
            return scoreOf(2, 0.5)
          }),
        )
      },
    })
    const reading = await jevSentiment('I keep checking the hallway.', {
      variant: 'thresholds',
      thresholds: emptyFittedThresholds({ fear: 0.3, longing: 0.7 }, { nDev: 10 }),
    })
    expect(reading.emotions).toContain('fear')
    expect(reading.emotions).not.toContain('longing')
  })
})
