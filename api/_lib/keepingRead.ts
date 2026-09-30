import { createHash } from 'node:crypto'
import { parseReferences } from '../../src/lib/scripture/parse.js'
import { callModel } from './openai.js'
import { env } from './env.js'

export const KEEPING_READ_VERSION = 'movements-v2-seven-signals'
/** Reported only when GATHER_SENTIMENT=tight-denial. Flag-off keeps KEEPING_READ_VERSION. */
export const KEEPING_READ_VERSION_TIGHT = 'movements-v2-tight-denial'
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
  'stress',
] as const

export type Emotion = (typeof EMOTIONS)[number]
export type IngredientKind = 'desire' | 'story' | 'learning' | 'change' | 'prayer' | 'scripture'
type ModelIngredientKind = Exclude<IngredientKind, 'scripture'>
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
  /** Exact words in the movement supporting this label. */
  quote: string
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
    denied?: unknown
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
                    quote: { type: 'string', maxLength: 240 },
                  },
                  required: ['emotion', 'intensity', 'quote'],
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
                kind: {
                  type: 'string',
                  enum: ['desire', 'story', 'learning', 'change', 'prayer'],
                },
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
- Each emotion requires a short, exact quote from the movement that supports that label. Omit an emotion when you cannot point to its evidence.
- Give first-person statements such as "I felt happy", "I was furious", or "I felt stress" priority over inferred emotion. Include every explicitly named state before adding inferred ones.
- Use joy for happy/glad/delighted. Use anger only for angry/frustrated/furious language, fear only for afraid/scared/threatened language, weariness only for tired/exhausted/depleted language, and stress for stressed/tense/pressured/overwhelmed language. Stress alone is not evidence of anger, fear, or weariness.
- Emotion is not spiritual discernment. Never infer faith, maturity, obedience, health, growth, divine intent, diagnosis, or advice.

INGREDIENTS
- desire: something the writer explicitly wants, hopes for, wishes for, or longs for. Report the expressed desire; never infer a hidden motive.
- story: a concrete thing that happened, with people/action/time; not general reflection.
- learning: an understanding the writer explicitly states or clearly arrives at in these exact words.
- change: an explicit before/after shift stated inside this page ("I used to... now...", "at first... but..."). This is evidence of change, never a claim of spiritual growth.
- prayer: words addressed to God, Jesus, or the Holy Spirit, including a request, thanks, confession, lament, or simple attention. Writing about prayer is not itself a prayer.
- Scripture references are added deterministically after your read. Do not return scripture ingredients.
- An ingredient quote must sit inside its movement quote. Omit rather than infer.

Return the structured result only.`

const V2_EMOTION_LINE =
  '- Use joy for happy/glad/delighted. Use anger only for angry/frustrated/furious language, fear only for afraid/scared/threatened language, weariness only for tired/exhausted/depleted language, and stress for stressed/tense/pressured/overwhelmed language. Stress alone is not evidence of anger, fear, or weariness.'

/** Tight definitions from lab/jev-classifier@9566d4c sentiment.ts EMO_DEF. */
export const EMO_DEF: Record<Emotion, string> = {
  joy: 'gladness or delight the writer feels',
  peace: 'calm or settledness the writer feels — not "peace" as a request or a news topic',
  gratitude: 'thankfulness the writer feels toward God or someone',
  hope: 'expectant confidence the writer feels — not a quoted verse about hope',
  love: 'affection or tenderness the writer feels toward a person or God ("I love you", "I felt loved"). Not someone else loving, not "love" as a topic.',
  longing: 'the writer aches for someone or something absent. Not a lyric they quote, not someone else missing them, not nostalgia named without ache.',
  sadness: 'the writer feels sad, down, or sorrowful. Not mere tiredness, not weather, not someone else being sad.',
  grief: 'the writer is mourning a specific loss',
  fear: 'the writer is afraid, scared, or feels threatened ("I am scared", "I am afraid"). Not mere busyness. Not "fear not" as quoted Scripture unless they say they are afraid.',
  anger: 'the writer is angry, furious, or resentful. Not mere stress.',
  shame: 'the writer feels ashamed, exposed, or unworthy ("I felt small / dirty / like I should hide"). Not someone shaming them unless they feel the shame.',
  confusion: 'the writer is unsure what is true or what to do',
  weariness: 'the writer is tired, exhausted, or depleted',
  stress: 'the writer feels tense, pressured, or overwhelmed — stress alone is not anger, fear, or weariness',
}

const EXCLUSION =
  'mentions of the word without the writer feeling it; negation or denial ("I\'m not X", "I don\'t feel X"); another person\'s emotion; a quoted speaker, song, or verse; a topic\'s stereotypical mood'

const TIGHT_EMOTION_BLOCK = [
  '- Emotion definitions (use exactly these meanings):',
  ...EMOTIONS.map((e) => `- ${e}: ${EMO_DEF[e]}`),
  `- Count only the writer's own felt emotion. Do not count: ${EXCLUSION}.`,
  '- First fill "denied": every emotion from the list the page NAMES but the writer does not feel — negated or denied ("I\'m not angry", "I don\'t feel afraid"), someone else\'s feeling, or a quoted song/verse/speaker. An emotion in "denied" must not be marked as felt.',
].join('\n')

export function keepingReadVersion(): string {
  return env.gatherSentiment() === 'tight-denial' ? KEEPING_READ_VERSION_TIGHT : KEEPING_READ_VERSION
}

export function keepingReadSystem(): string {
  if (env.gatherSentiment() !== 'tight-denial') return SYSTEM
  return SYSTEM.replace(V2_EMOTION_LINE, TIGHT_EMOTION_BLOCK)
}

export function keepingReadSchema(): Record<string, unknown> {
  if (env.gatherSentiment() !== 'tight-denial') return SCHEMA as unknown as Record<string, unknown>
  const clone = structuredClone(SCHEMA) as {
    properties: {
      movements: {
        items: {
          properties: {
            sentiment: {
              properties: Record<string, unknown>
              required: string[]
            }
          }
        }
      }
    }
  }
  const sentiment = clone.properties.movements.items.properties.sentiment
  const { emotions, ...rest } = sentiment.properties
  sentiment.properties = {
    ...rest,
    denied: { type: 'array', items: { type: 'string', enum: [...EMOTIONS] } },
    emotions,
  }
  const emoIdx = sentiment.required.indexOf('emotions')
  if (!sentiment.required.includes('denied')) {
    sentiment.required.splice(emoIdx < 0 ? sentiment.required.length : emoIdx, 0, 'denied')
  }
  return clone
}

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

function sanitizeSentiment(
  raw: RawMovement['sentiment'],
  movementQuote: string,
): SentimentReading {
  if (!raw || raw.present !== true) {
    return {
      ...emptySentiment(),
      confidence: clamp(raw?.confidence, 0, 1),
    }
  }
  const denied = new Set(
    (Array.isArray(raw.denied) ? raw.denied : []).filter((e): e is Emotion => isEmotion(e)),
  )
  const seen = new Set<string>()
  const emotions: EmotionScore[] = []
  if (Array.isArray(raw.emotions)) {
    for (const item of raw.emotions) {
      const row = item as { emotion?: unknown; intensity?: unknown; quote?: unknown }
      if (!isEmotion(row.emotion) || seen.has(row.emotion) || denied.has(row.emotion)) continue
      if (
        typeof row.quote !== 'string' ||
        row.quote.length < 2 ||
        !movementQuote.includes(row.quote)
      ) {
        continue
      }
      seen.add(row.emotion)
      emotions.push({
        emotion: row.emotion,
        intensity: clamp(row.intensity, 0, 1),
        quote: row.quote,
      })
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

const isIngredient = (value: unknown): value is ModelIngredientKind =>
  value === 'desire' ||
  value === 'story' ||
  value === 'learning' ||
  value === 'change' ||
  value === 'prayer'

function readableMarkdown(markdown: string): string {
  // Keep the writer's prose but remove Dayspring's storage syntax. Unlike
  // notice.stripFences, the read must not discard a declared prayer or story.
  return markdown
    .replace(/^```dayspring-[^\n]*\n([\s\S]*?)^```[ \t]*(?:\r?\n|$)/gim, '$1')
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
  const emotions = new Map<
    Emotion,
    { weighted: number; weight: number; quote: string; quoteScore: number }
  >()
  for (const movement of felt) {
    const w = Math.max(1, movement.quote.length) * movement.sentiment.confidence
    weight += w
    valence += movement.sentiment.valence * w
    activation += movement.sentiment.activation * w
    confidence += movement.sentiment.confidence * w
    for (const emotion of movement.sentiment.emotions) {
      const quoteScore = emotion.intensity * w
      const held = emotions.get(emotion.emotion) ?? {
        weighted: 0,
        weight: 0,
        quote: emotion.quote,
        quoteScore,
      }
      held.weighted += emotion.intensity * w
      held.weight += w
      if (quoteScore > held.quoteScore) {
        held.quote = emotion.quote
        held.quoteScore = quoteScore
      }
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
        quote: score.quote,
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
  const scriptureRefs = parseReferences(text)
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
    const charEnd = charStart + quote.length
    const seenScripture = new Set(
      ingredients
        .filter((ingredient) => ingredient.kind === 'scripture')
        .map((ingredient) => ingredient.quote),
    )
    for (const ref of scriptureRefs) {
      if (ref.char_start < charStart || ref.char_end > charEnd) continue
      const scriptureQuote = text.slice(ref.char_start, ref.char_end)
      if (seenScripture.has(scriptureQuote)) continue
      seenScripture.add(scriptureQuote)
      ingredients.push({
        kind: 'scripture',
        quote: scriptureQuote,
        confidence: ref.confidence,
      })
    }
    movements.push({
      id: createHash('sha256').update(`${entryId}\0${quote}`).digest('hex').slice(0, 16),
      quote,
      charStart,
      charEnd,
      subjects: joined,
      sentiment: sanitizeSentiment(candidate.sentiment, quote),
      ingredients,
    })
    if (movements.length === MAX_MOVEMENTS) break
  }

  return {
    version: keepingReadVersion(),
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
    keepingReadSystem(),
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
    keepingReadSchema(),
    'keeping_read',
    'low',
    4096,
  )
  return sanitizeKeepingRead(raw, entry.id, text, subjects, truncated)
}

export function entryTextForKeeping(markdown: string): { text: string; truncated: boolean } {
  return boundedText(markdown)
}
