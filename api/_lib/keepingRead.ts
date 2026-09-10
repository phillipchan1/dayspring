import { createHash } from 'node:crypto'
import { callModel } from './openai.js'

export const KEEPING_READ_VERSION = 'movements-v1'
export const MAX_ENTRY_CHARS = 20_000
export const MAX_SUBJECTS = 80
export const MAX_MOVEMENTS = 12

export const EMOTIONS = [
  'joy',
  'peace',
  'gratitude',
  'hope',
  'love',
  'longing',
  'sadness',
  'grief',
  'fear',
  'anger',
  'shame',
  'confusion',
  'weariness',
] as const

export type Emotion = (typeof EMOTIONS)[number]
export type IngredientKind = 'story' | 'learning' | 'change'
export type SubjectKind = 'person' | 'place' | 'domain' | 'matter'

export interface SubjectCandidate {
  key: string
  label: string
  terms: string[]
  kind: SubjectKind
  writerNamed: boolean
}

export interface EmotionScore {
  emotion: Emotion
  intensity: number
}

export interface SentimentReading {
  /** False means the movement does not express the writer's own emotion. */
  present: boolean
  /** Emotional pleasantness, not goodness: -1 unpleasant, 0 mixed/neutral, 1 pleasant. */
  valence: number
  /** Felt energy: 0 still/depleted, 1 activated/urgent. */
  activation: number
  confidence: number
  emotions: EmotionScore[]
}

export interface IngredientReading {
  kind: IngredientKind
  quote: string
  confidence: number
}

export interface MovementReading {
  id: string
  quote: string
  charStart: number
  charEnd: number
  subjects: Array<Pick<SubjectCandidate, 'key' | 'label' | 'kind'>>
  sentiment: SentimentReading
  ingredients: IngredientReading[]
}

export interface EntryReading {
  version: string
  entryId: string
  truncated: boolean
  sentiment: SentimentReading
  movements: MovementReading[]
}

interface RawMovement {
  quote?: unknown
  subject_keys?: unknown
  sentiment?: {
    present?: unknown
    valence?: unknown
    activation?: unknown
    confidence?: unknown
    emotions?: unknown
  }
  ingredients?: unknown
}

interface RawReading {
  movements?: RawMovement[]
}

const SCHEMA = {
  type: 'object',
  properties: {
    movements: {
      type: 'array',
      maxItems: MAX_MOVEMENTS,
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string', maxLength: 2400 },
          subject_keys: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string', maxLength: 180 },
          },
          sentiment: {
            type: 'object',
            properties: {
              present: { type: 'boolean' },
              valence: { type: 'number', minimum: -1, maximum: 1 },
              activation: { type: 'number', minimum: 0, maximum: 1 },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              emotions: {
                type: 'array',
                maxItems: 4,
                items: {
                  type: 'object',
                  properties: {
                    emotion: { type: 'string', enum: [...EMOTIONS] },
                    intensity: { type: 'number', minimum: 0, maximum: 1 },
                  },
                  required: ['emotion', 'intensity'],
                  additionalProperties: false,
                },
              },
            },
            required: ['present', 'valence', 'activation', 'confidence', 'emotions'],
            additionalProperties: false,
          },
          ingredients: {
            type: 'array',
            maxItems: 6,
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['story', 'learning', 'change'] },
                quote: { type: 'string', maxLength: 800 },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
              required: ['kind', 'quote', 'confidence'],
              additionalProperties: false,
            },
          },
        },
        required: ['quote', 'subject_keys', 'sentiment', 'ingredients'],
        additionalProperties: false,
      },
    },
  },
  required: ['movements'],
  additionalProperties: false,
} as const

const SYSTEM = `You read ONE page from a private Christian journal. Divide only its meaningful prose into coherent movements: each movement is one turn of attention, event, reflection, or interior response.

GROUNDING
- Every movement.quote and ingredient.quote MUST be copied CHARACTER FOR CHARACTER from the entry. Never paraphrase, tidy, join distant spans, or add words.
- Prefer a complete paragraph or complete run of adjacent sentences for movement.quote.
- Return at most ${MAX_MOVEMENTS} movements. Omit headings, metadata, boilerplate, quoted Scripture, and empty prose.

SUBJECTS
- You receive the writer's known subjects. Attach only subject_keys from that list.
- A subject may be semantically present without its label appearing literally: a passage about the children can belong to a writer-named Family domain.
- Join a subject only when this movement is genuinely about it, not merely because it is mentioned nearby.
- Never invent a key. God, Jesus, and the Holy Spirit are the addressee of this journal, not subjects unless explicitly supplied.

SENTIMENT
- Estimate only emotion EXPRESSED BY THE WRITER in this movement.
- Do not assign a quoted speaker's emotion, another person's emotion, a topic's stereotypical emotion, or an emotion merely named and denied.
- present=false is normal. For absent emotion return valence=0, activation=0, confidence reflecting confidence that no writer emotion is expressed, and emotions=[].
- Valence is pleasantness, never goodness. Activation is felt energy or urgency, never importance.
- Mixed emotions are expected. Use up to four from the supplied vocabulary.
- Emotion is not spiritual discernment. Never infer faith, maturity, obedience, health, growth, divine intent, diagnosis, or advice.

INGREDIENTS
- story: a concrete thing that happened, with people/action/time; not general reflection.
- learning: an understanding the writer explicitly states or clearly arrives at in these exact words.
- change: an explicit before/after shift stated inside this page ("I used to... now...", "at first... but..."). This is evidence of change, never a claim of spiritual growth.
- An ingredient quote must sit inside its movement quote. Omit rather than infer.

Return the structured result only.`

const clamp = (value: unknown, min: number, max: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : min
  return Math.min(max, Math.max(min, n))
}

const isEmotion = (value: unknown): value is Emotion =>
  typeof value === 'string' && (EMOTIONS as readonly string[]).includes(value)

const emptySentiment = (): SentimentReading => ({
  present: false,
  valence: 0,
  activation: 0,
  confidence: 0,
  emotions: [],
})

function sanitizeSentiment(raw: RawMovement['sentiment']): SentimentReading {
  if (!raw || raw.present !== true) {
    return {
      ...emptySentiment(),
      confidence: clamp(raw?.confidence, 0, 1),
    }
  }
  const seen = new Set<string>()
  const emotions: EmotionScore[] = []
  if (Array.isArray(raw.emotions)) {
    for (const item of raw.emotions) {
      const row = item as { emotion?: unknown; intensity?: unknown }
      if (!isEmotion(row.emotion) || seen.has(row.emotion)) continue
      seen.add(row.emotion)
      emotions.push({ emotion: row.emotion, intensity: clamp(row.intensity, 0, 1) })
      if (emotions.length === 4) break
    }
  }
  return {
    present: true,
    valence: clamp(raw.valence, -1, 1),
    activation: clamp(raw.activation, 0, 1),
    confidence: clamp(raw.confidence, 0, 1),
    emotions,
  }
}

const isIngredient = (value: unknown): value is IngredientKind =>
  value === 'story' || value === 'learning' || value === 'change'

function readableMarkdown(markdown: string): string {
  // Keep the writer's prose but remove Dayspring's storage syntax. Unlike
  // notice.stripFences, the read must not discard a declared prayer or story.
  return markdown
    .replace(/^```dayspring-[^\n]*\n/gim, '')
    .replace(/^```[ \t]*$/gm, '')
    .trim()
}

function boundedText(markdown: string): { text: string; truncated: boolean } {
  const readable = readableMarkdown(markdown)
  if (readable.length <= MAX_ENTRY_CHARS) return { text: readable, truncated: false }
  const slice = readable.slice(0, MAX_ENTRY_CHARS)
  const paragraph = slice.lastIndexOf('\n\n')
  return {
    text: paragraph >= MAX_ENTRY_CHARS * 0.7 ? slice.slice(0, paragraph) : slice,
    truncated: true,
  }
}

function aggregateSentiment(movements: MovementReading[]): SentimentReading {
  const felt = movements.filter((m) => m.sentiment.present && m.sentiment.confidence > 0)
  if (felt.length === 0) return emptySentiment()
  let weight = 0
  let valence = 0
  let activation = 0
  let confidence = 0
  const emotions = new Map<Emotion, { weighted: number; weight: number }>()
  for (const movement of felt) {
    const w = Math.max(1, movement.quote.length) * movement.sentiment.confidence
    weight += w
    valence += movement.sentiment.valence * w
    activation += movement.sentiment.activation * w
    confidence += movement.sentiment.confidence * w
    for (const emotion of movement.sentiment.emotions) {
      const held = emotions.get(emotion.emotion) ?? { weighted: 0, weight: 0 }
      held.weighted += emotion.intensity * w
      held.weight += w
      emotions.set(emotion.emotion, held)
    }
  }
  return {
    present: true,
    valence: weight ? valence / weight : 0,
    activation: weight ? activation / weight : 0,
    confidence: weight ? confidence / weight : 0,
    emotions: [...emotions.entries()]
      .map(([emotion, score]) => ({
        emotion,
        intensity: score.weight ? score.weighted / score.weight : 0,
      }))
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 4),
  }
}

export function sanitizeKeepingRead(
  raw: RawReading | null,
  entryId: string,
  text: string,
  subjects: SubjectCandidate[],
  truncated = false,
): EntryReading {
  const allowedSubjects = new Map(subjects.map((subject) => [subject.key, subject]))
  const movements: MovementReading[] = []
  const seenQuotes = new Set<string>()

  for (const candidate of raw?.movements ?? []) {
    const quote = typeof candidate.quote === 'string' ? candidate.quote : ''
    if (quote.length < 12 || !text.includes(quote) || seenQuotes.has(quote)) continue
    seenQuotes.add(quote)

    const ingredients: IngredientReading[] = []
    if (Array.isArray(candidate.ingredients)) {
      const seenIngredients = new Set<string>()
      for (const item of candidate.ingredients) {
        const row = item as { kind?: unknown; quote?: unknown; confidence?: unknown }
        if (!isIngredient(row.kind) || typeof row.quote !== 'string') continue
        if (!quote.includes(row.quote) || row.quote.length < 8) continue
        const key = `${row.kind}:${row.quote}`
        if (seenIngredients.has(key)) continue
        seenIngredients.add(key)
        ingredients.push({
          kind: row.kind,
          quote: row.quote,
          confidence: clamp(row.confidence, 0, 1),
        })
      }
    }

    const subjectKeys = Array.isArray(candidate.subject_keys)
      ? candidate.subject_keys.filter((key): key is string => typeof key === 'string')
      : []
    const joined = [...new Set(subjectKeys)]
      .map((key) => allowedSubjects.get(key))
      .filter((subject): subject is SubjectCandidate => Boolean(subject))
      .map(({ key, label, kind }) => ({ key, label, kind }))

    const charStart = text.indexOf(quote)
    movements.push({
      id: createHash('sha256').update(`${entryId}\0${quote}`).digest('hex').slice(0, 16),
      quote,
      charStart,
      charEnd: charStart + quote.length,
      subjects: joined,
      sentiment: sanitizeSentiment(candidate.sentiment),
      ingredients,
    })
    if (movements.length === MAX_MOVEMENTS) break
  }

  return {
    version: KEEPING_READ_VERSION,
    entryId,
    truncated,
    sentiment: aggregateSentiment(movements),
    movements,
  }
}

export async function readEntryWithKeeping(
  entry: { id: string; body_markdown: string; created_at: string },
  subjects: SubjectCandidate[],
): Promise<EntryReading> {
  const { text, truncated } = boundedText(entry.body_markdown)
  if (text.length < 40) return sanitizeKeepingRead(null, entry.id, text, subjects, truncated)
  const raw = await callModel<RawReading>(
    SYSTEM,
    {
      entry: { id: entry.id, date: entry.created_at, text },
      subjects: subjects.map(({ key, label, terms, kind, writerNamed }) => ({
        key,
        label,
        terms,
        kind,
        writer_named: writerNamed,
      })),
    },
    SCHEMA as unknown as Record<string, unknown>,
    'keeping_read',
    'low',
    4096,
  )
  return sanitizeKeepingRead(raw, entry.id, text, subjects, truncated)
}

export function entryTextForKeeping(markdown: string): { text: string; truncated: boolean } {
  return boundedText(markdown)
}
