/**
 * Lab-only OpenAI sentiment seam for the recognition eval.
 * Not imported by api/keeping/read.ts — production Keeping read is unchanged.
 */

import { callModel } from '../openai.js'
import { EMOTIONS, type Emotion } from '../keepingRead.js'
import type { JevSentiment, ValenceBucket } from './sentiment.js'

const SYSTEM = `You read ONE page from a private Christian journal and estimate the WRITER's own expressed emotion.

Rules (from the Keeping read SENTIMENT contract):
- Estimate only emotion EXPRESSED BY THE WRITER.
- Do not assign a quoted speaker's emotion, another person's emotion, a topic's stereotypical emotion, or an emotion merely named and denied ("I'm not angry, just tired").
- present=false is normal. For absent emotion return valence=0, activation=0, emotions=[].
- Valence is pleasantness, never goodness, in [-1, 1]. Activation is felt energy in [0, 1].
- Use at most four labels from: ${EMOTIONS.join(', ')}.
- joy = happy/glad/delighted. anger = angry/frustrated/furious. fear = afraid/scared/threatened. weariness = tired/exhausted/depleted. stress = stressed/tense/pressured/overwhelmed. Stress alone is not anger, fear, or weariness.
- Emotion is not spiritual discernment. Never infer faith, maturity, or diagnosis.

Return JSON only.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['present', 'valence', 'activation', 'emotions'],
  properties: {
    present: { type: 'boolean' },
    valence: { type: 'number' },
    activation: { type: 'number' },
    emotions: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', enum: [...EMOTIONS] },
    },
  },
} as const

function bucket(v: number): ValenceBucket {
  if (v < -0.33) return 'negative'
  if (v > 0.33) return 'positive'
  return 'mixed'
}

export async function openaiSentiment(text: string): Promise<JevSentiment> {
  const out = await callModel<{
    present?: boolean
    valence?: number
    activation?: number
    emotions?: string[]
  }>(
    SYSTEM,
    { text: text.slice(0, 20_000) },
    SCHEMA as unknown as Record<string, unknown>,
    'lab_sentiment',
    'low',
    400,
  )
  const present = out.present === true
  const valence = present ? clamp(out.valence ?? 0, -1, 1) : 0
  const activation = present ? clamp(out.activation ?? 0, 0, 1) : 0
  const allowed = new Set<string>(EMOTIONS)
  const emotions = (out.emotions ?? []).filter((e): e is Emotion => allowed.has(e)).slice(0, 4)
  return {
    present,
    valenceBucket: present ? bucket(valence) : 'mixed',
    valence,
    activation,
    emotions,
    probs: { present: present ? 1 : 0, valence, activation, emotions: {} },
    confidence: 1,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
