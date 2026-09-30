import { afterEach, describe, expect, it } from 'vitest'
import {
  entryTextForKeeping,
  KEEPING_READ_VERSION,
  KEEPING_READ_VERSION_TIGHT,
  keepingReadSchema,
  keepingReadSystem,
  sanitizeKeepingRead,
  type SubjectCandidate,
} from './keepingRead'

const subjects: SubjectCandidate[] = [
  {
    key: 'word:family',
    label: 'Family',
    terms: ['family'],
    kind: 'domain',
    writerNamed: true,
  },
]

describe('sanitizeKeepingRead', () => {
  it('keeps grounded scores, subjects, and ingredients', () => {
    const text =
      'The boys were both sick, and I felt exhausted and afraid. I learned that asking for help is not failure.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: ['word:family'],
            sentiment: {
              present: true,
              valence: -0.7,
              activation: 0.8,
              confidence: 0.9,
              emotions: [
                { emotion: 'weariness', intensity: 0.9, quote: 'exhausted' },
                { emotion: 'fear', intensity: 0.7, quote: 'afraid' },
              ],
            },
            ingredients: [
              {
                kind: 'learning',
                quote: 'I learned that asking for help is not failure.',
                confidence: 0.95,
              },
            ],
          },
        ],
      },
      'entry-1',
      text,
      subjects,
    )

    expect(result.movements).toHaveLength(1)
    expect(result.movements[0]?.subjects).toEqual([
      { key: 'word:family', label: 'Family', kind: 'domain' },
    ])
    expect(result.movements[0]?.ingredients[0]?.kind).toBe('learning')
    expect(result.sentiment.present).toBe(true)
    expect(result.sentiment.emotions.map((emotion) => emotion.emotion)).toEqual([
      'weariness',
      'fear',
    ])
    expect(result.sentiment.emotions[0]?.quote).toBe('exhausted')
  })

  it('drops fabricated quotes, unknown subjects, and ingredients outside a movement', () => {
    const text = 'I called Mom after dinner and we talked for an hour.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: 'I called Mom after dinner and we talked for an hour.',
            subject_keys: ['invented'],
            sentiment: {
              present: false,
              valence: 1,
              activation: 1,
              confidence: 0.8,
              emotions: [{ emotion: 'joy', intensity: 1, quote: 'talked' }],
            },
            ingredients: [
              { kind: 'story', quote: 'Words that are not in the movement.', confidence: 1 },
            ],
          },
          {
            quote: 'A memory the writer never wrote.',
            subject_keys: [],
            sentiment: {
              present: true,
              valence: 1,
              activation: 1,
              confidence: 1,
              emotions: [{ emotion: 'joy', intensity: 1, quote: 'never wrote' }],
            },
            ingredients: [],
          },
        ],
      },
      'entry-2',
      text,
      subjects,
    )

    expect(result.movements).toHaveLength(1)
    expect(result.movements[0]?.subjects).toEqual([])
    expect(result.movements[0]?.ingredients).toEqual([])
    expect(result.movements[0]?.sentiment).toEqual({
      present: false,
      valence: 0,
      activation: 0,
      confidence: 0.8,
      emotions: [],
    })
  })

  it('clamps scores and deduplicates emotions', () => {
    const text = 'I was angry, but underneath it I was mostly afraid.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: [],
            sentiment: {
              present: true,
              valence: -9,
              activation: 4,
              confidence: 2,
              emotions: [
                { emotion: 'fear', intensity: 5, quote: 'afraid' },
                { emotion: 'fear', intensity: 0.2, quote: 'afraid' },
                { emotion: 'surprise', intensity: 1, quote: 'angry' },
              ],
            },
            ingredients: [],
          },
        ],
      },
      'entry-3',
      text,
      [],
    )

    expect(result.movements[0]?.sentiment).toEqual({
      present: true,
      valence: -1,
      activation: 1,
      confidence: 1,
      emotions: [{ emotion: 'fear', intensity: 1, quote: 'afraid' }],
    })
  })

  it('drops an emotion without grounded evidence and keeps explicit mixed emotion', () => {
    const text =
      'I felt happy that we are going to be off this project, but this afternoon I felt stress because we are still on the hook for it.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: [],
            sentiment: {
              present: true,
              valence: 0.1,
              activation: 0.65,
              confidence: 0.92,
              emotions: [
                { emotion: 'joy', intensity: 0.8, quote: 'felt happy' },
                { emotion: 'stress', intensity: 0.75, quote: 'felt stress' },
                { emotion: 'anger', intensity: 0.4, quote: 'words not on the page' },
              ],
            },
            ingredients: [],
          },
        ],
      },
      'entry-mixed',
      text,
      [],
    )

    expect(result.movements[0]?.sentiment.emotions).toEqual([
      { emotion: 'joy', intensity: 0.8, quote: 'felt happy' },
      { emotion: 'stress', intensity: 0.75, quote: 'felt stress' },
    ])
  })

  it('adds scripture references deterministically to their movement', () => {
    const text = 'I returned to Romans 8:28 tonight and remembered that I am not alone.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: [],
            sentiment: {
              present: false,
              valence: 0,
              activation: 0,
              confidence: 0.8,
              emotions: [],
            },
            ingredients: [],
          },
        ],
      },
      'entry-scripture',
      text,
      [],
    )

    expect(result.movements[0]?.ingredients).toContainEqual({
      kind: 'scripture',
      quote: 'Romans 8:28',
      confidence: 1,
    })
  })

  it('keeps grounded desire and prayer but rejects model-authored scripture', () => {
    const text =
      'I want to become less hurried. Lord, help me pay attention to the person before me.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: [],
            sentiment: {
              present: true,
              valence: 0.2,
              activation: 0.3,
              confidence: 0.8,
              emotions: [{ emotion: 'longing', intensity: 0.7, quote: 'I want' }],
            },
            ingredients: [
              {
                kind: 'desire',
                quote: 'I want to become less hurried.',
                confidence: 0.99,
              },
              {
                kind: 'prayer',
                quote: 'Lord, help me pay attention to the person before me.',
                confidence: 0.99,
              },
              {
                kind: 'scripture',
                quote: 'Lord, help me',
                confidence: 1,
              },
            ],
          },
        ],
      },
      'entry-desire-prayer',
      text,
      [],
    )

    expect(result.movements[0]?.ingredients).toEqual([
      {
        kind: 'desire',
        quote: 'I want to become less hurried.',
        confidence: 0.99,
      },
      {
        kind: 'prayer',
        quote: 'Lord, help me pay attention to the person before me.',
        confidence: 0.99,
      },
    ])
  })
})

describe('gatherSentiment tight-denial', () => {
  const saved: string | undefined = process.env.GATHER_SENTIMENT

  afterEach(() => {
    if (saved === undefined) delete process.env.GATHER_SENTIMENT
    else process.env.GATHER_SENTIMENT = saved
  })

  it('drops denied emotions', () => {
    const text = 'I am not angry, just tired. I felt exhausted.'
    const result = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: [],
            sentiment: {
              present: true,
              valence: -0.3,
              activation: 0.2,
              confidence: 0.9,
              denied: ['anger'],
              emotions: [
                { emotion: 'anger', intensity: 0.8, quote: 'angry' },
                { emotion: 'weariness', intensity: 0.7, quote: 'exhausted' },
              ],
            },
            ingredients: [],
          },
        ],
      },
      'entry-denied',
      text,
      [],
    )
    expect(result.movements[0]?.sentiment.emotions.map((e) => e.emotion)).toEqual(['weariness'])
    expect(result.version).toBe(KEEPING_READ_VERSION)
  })

  it('puts denied before emotions in the schema only when flagged', () => {
    delete process.env.GATHER_SENTIMENT
    const off = keepingReadSchema() as {
      properties: { movements: { items: { properties: { sentiment: { properties: Record<string, unknown>; required: string[] } } } } }
    }
    const offSent = off.properties.movements.items.properties.sentiment
    expect(offSent.properties.denied).toBeUndefined()
    expect(offSent.required).not.toContain('denied')

    process.env.GATHER_SENTIMENT = 'tight-denial'
    const on = keepingReadSchema() as {
      properties: { movements: { items: { properties: { sentiment: { properties: Record<string, unknown>; required: string[] } } } } }
    }
    const sent = on.properties.movements.items.properties.sentiment
    const keys = Object.keys(sent.properties)
    expect(keys.indexOf('denied')).toBeGreaterThanOrEqual(0)
    expect(keys.indexOf('denied')).toBeLessThan(keys.indexOf('emotions'))
    expect(sent.required.indexOf('denied')).toBeLessThan(sent.required.indexOf('emotions'))
  })

  it('puts the tight definitions in the prompt only when flagged', () => {
    delete process.env.GATHER_SENTIMENT
    const off = keepingReadSystem()
    expect(off).toContain('Use joy for happy/glad/delighted')
    expect(off).not.toContain('gladness or delight the writer feels')
    expect(off).not.toContain('First fill "denied"')

    process.env.GATHER_SENTIMENT = 'tight-denial'
    const on = keepingReadSystem()
    expect(on).toContain('gladness or delight the writer feels')
    expect(on).toContain('Not mere stress.')
    expect(on).toContain('First fill "denied"')
    expect(on).not.toContain('Use joy for happy/glad/delighted')
    const text = 'I felt exhausted after the long day at home.'
    const flagged = sanitizeKeepingRead(
      {
        movements: [
          {
            quote: text,
            subject_keys: [],
            sentiment: {
              present: true,
              valence: -0.2,
              activation: 0.3,
              confidence: 0.8,
              denied: [],
              emotions: [{ emotion: 'weariness', intensity: 0.7, quote: 'exhausted' }],
            },
            ingredients: [],
          },
        ],
      },
      'entry-version',
      text,
      [],
    )
    expect(flagged.version).toBe(KEEPING_READ_VERSION_TIGHT)
  })
})

describe('entryTextForKeeping', () => {
  it('removes storage fences without discarding writer prose', () => {
    const markdown = [
      'Before.',
      '```dayspring-story 12345678-1234-1234-1234-123456789abc',
      'This happened.',
      '```',
      'After.',
    ].join('\n')

    expect(entryTextForKeeping(markdown).text).toBe('Before.\nThis happened.\nAfter.')
  })
})
