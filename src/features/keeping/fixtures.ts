import type { Entry } from '@/lib/types'
import type { KeepingEntryReading } from './types'

const now = '2026-09-08T07:30:00.000Z'

export const KEEPING_FIXTURE_ENTRIES: Entry[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    created_at: now,
    updated_at: now,
    title: 'The last box',
    body_markdown:
      'We packed the last box tonight. I expected relief, but standing in the empty kitchen I felt grief and gratitude together. The boys ran from room to room saying goodbye to every hiding place.\n\nI am learning that leaving well is its own kind of love.',
    mood: null,
    tags: [],
    word_count: 47,
    source: 'native',
    external_id: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    created_at: '2026-06-14T21:00:00.000Z',
    updated_at: '2026-06-14T21:00:00.000Z',
    title: 'After the meeting',
    body_markdown:
      'The meeting ended without a decision. At first I was furious that nobody would say the hard thing. By the drive home the anger had gone quiet, and underneath it I could finally admit I was afraid of being unnecessary.',
    mood: null,
    tags: [],
    word_count: 39,
    source: 'native',
    external_id: null,
  },
]

export const KEEPING_FIXTURE_READINGS: Record<string, KeepingEntryReading> = {
  [KEEPING_FIXTURE_ENTRIES[0]!.id]: {
    version: 'movements-v1',
    entryId: KEEPING_FIXTURE_ENTRIES[0]!.id,
    truncated: false,
    sentiment: {
      present: true,
      valence: 0.08,
      activation: 0.42,
      confidence: 0.92,
      emotions: [
        { emotion: 'grief', intensity: 0.78 },
        { emotion: 'gratitude', intensity: 0.72 },
        { emotion: 'love', intensity: 0.63 },
      ],
    },
    movements: [
      {
        id: 'fixture-move-one',
        quote:
          'We packed the last box tonight. I expected relief, but standing in the empty kitchen I felt grief and gratitude together. The boys ran from room to room saying goodbye to every hiding place.',
        charStart: 0,
        charEnd: 179,
        subjects: [
          { key: 'word:the move', label: 'The move', kind: 'matter' },
          { key: 'word:family', label: 'Family', kind: 'domain' },
        ],
        sentiment: {
          present: true,
          valence: -0.05,
          activation: 0.48,
          confidence: 0.96,
          emotions: [
            { emotion: 'grief', intensity: 0.86 },
            { emotion: 'gratitude', intensity: 0.81 },
            { emotion: 'love', intensity: 0.65 },
          ],
        },
        ingredients: [
          {
            kind: 'story',
            quote: 'We packed the last box tonight.',
            confidence: 0.98,
          },
        ],
      },
      {
        id: 'fixture-move-two',
        quote: 'I am learning that leaving well is its own kind of love.',
        charStart: 181,
        charEnd: 237,
        subjects: [{ key: 'word:the move', label: 'The move', kind: 'matter' }],
        sentiment: {
          present: true,
          valence: 0.48,
          activation: 0.23,
          confidence: 0.82,
          emotions: [
            { emotion: 'love', intensity: 0.72 },
            { emotion: 'peace', intensity: 0.42 },
          ],
        },
        ingredients: [
          {
            kind: 'learning',
            quote: 'I am learning that leaving well is its own kind of love.',
            confidence: 0.99,
          },
        ],
      },
    ],
  },
  [KEEPING_FIXTURE_ENTRIES[1]!.id]: {
    version: 'movements-v1',
    entryId: KEEPING_FIXTURE_ENTRIES[1]!.id,
    truncated: false,
    sentiment: {
      present: true,
      valence: -0.63,
      activation: 0.76,
      confidence: 0.94,
      emotions: [
        { emotion: 'anger', intensity: 0.83 },
        { emotion: 'fear', intensity: 0.77 },
      ],
    },
    movements: [
      {
        id: 'fixture-meeting-one',
        quote:
          'The meeting ended without a decision. At first I was furious that nobody would say the hard thing. By the drive home the anger had gone quiet, and underneath it I could finally admit I was afraid of being unnecessary.',
        charStart: 0,
        charEnd: 205,
        subjects: [{ key: 'word:work', label: 'Work', kind: 'domain' }],
        sentiment: {
          present: true,
          valence: -0.63,
          activation: 0.76,
          confidence: 0.94,
          emotions: [
            { emotion: 'anger', intensity: 0.83 },
            { emotion: 'fear', intensity: 0.77 },
          ],
        },
        ingredients: [
          {
            kind: 'story',
            quote: 'The meeting ended without a decision.',
            confidence: 0.91,
          },
          {
            kind: 'change',
            quote:
              'At first I was furious that nobody would say the hard thing. By the drive home the anger had gone quiet, and underneath it I could finally admit I was afraid of being unnecessary.',
            confidence: 0.94,
          },
        ],
      },
    ],
  },
}
