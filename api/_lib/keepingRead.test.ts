import { describe, expect, it } from 'vitest'
import {
  entryTextForKeeping,
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
                { emotion: 'weariness', intensity: 0.9 },
                { emotion: 'fear', intensity: 0.7 },
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
              emotions: [{ emotion: 'joy', intensity: 1 }],
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
              emotions: [{ emotion: 'joy', intensity: 1 }],
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
                { emotion: 'fear', intensity: 5 },
                { emotion: 'fear', intensity: 0.2 },
                { emotion: 'surprise', intensity: 1 },
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
      emotions: [{ emotion: 'fear', intensity: 1 }],
    })
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
