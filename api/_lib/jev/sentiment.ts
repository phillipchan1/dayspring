/**
 * Jev sentiment — closed label set matching keepingRead.ts EMOTIONS.
 * Lab only; not wired into api/keeping/read.ts.
 */

import { noul, score } from '@typesafe-ai/sdk'
import { EMOTIONS, type Emotion } from '../keepingRead.js'
import { askJev } from '../typesafe.js'

export type ValenceBucket = 'negative' | 'mixed' | 'positive'

export interface JevSentiment {
  present: boolean
  valenceBucket: ValenceBucket
  /** Expected value on [-1, 1] (weighted average of the rubric). Secondary. */
  valence: number
  /** Same as `valence`, kept so reports can print expected value next to the argmax bucket. */
  valenceExpected: number
  /** Argmax rubric level 0..4. */
  valenceLevel: number
  activation: number
  emotions: Emotion[]
  probs: {
    present: number
    valence: number
    activation: number
    emotions: Partial<Record<Emotion, number>>
  }
  confidence: number
}

const VALENCE_CRITERIA = [
  'very unpleasant — the writer\'s own expressed feeling is strongly negative',
  'unpleasant — the writer\'s own expressed feeling is negative',
  'mixed or neutral — mixed feelings, flat affect, or no clear pleasantness',
  'pleasant — the writer\'s own expressed feeling is positive',
  'very pleasant — the writer\'s own expressed feeling is strongly positive',
] as const

const ACTIVATION_CRITERIA = [
  'still or depleted — low energy, tired, numb, quiet',
  'moderate — ordinary energy, neither still nor urgent',
  'activated or urgent — high energy, agitated, pressured, or urgent',
] as const

const EMO_HINT: Record<Emotion, string> = {
  joy: 'happy, glad, delighted — not someone else\'s joy',
  peace: 'calm, settled, at rest',
  gratitude: 'thankful, grateful',
  hope: 'hopeful, expectant',
  love: 'affection, tenderness toward someone',
  longing: 'yearning, missing, aching for',
  sadness: 'sad, down, sorrowful — not merely tired',
  grief: 'mourning a loss',
  fear: 'afraid, scared, threatened — not merely stressed',
  anger: 'angry, frustrated, furious — not merely stressed',
  shame: 'ashamed, exposed, unworthy',
  confusion: 'confused, lost, unsure what is true',
  weariness: 'tired, exhausted, depleted — not merely stressed',
  stress: 'stressed, tense, pressured, overwhelmed — stress alone is not anger, fear, or weariness',
}

/** Bucket the argmax rubric level: 0–1 negative, 2 mixed, 3–4 positive. */
export function bucketValenceLevel(level: number): ValenceBucket {
  if (level <= 1) return 'negative'
  if (level >= 3) return 'positive'
  return 'mixed'
}

export function argmaxScore(
  ans: { score?: number; probabilities?: Record<string, number> } | undefined,
  fallback: number,
): { level: number; p: number; expected: number } {
  const expected = ans && typeof ans.score === 'number' ? ans.score : fallback
  const probs = ans?.probabilities ?? {}
  let bestLevel = Math.round(expected)
  let bestP = -1
  for (const [k, v] of Object.entries(probs)) {
    const level = Number(k)
    if (!Number.isFinite(level) || typeof v !== 'number') continue
    if (v > bestP || (v === bestP && level < bestLevel)) {
      bestP = v
      bestLevel = level
    }
  }
  if (bestP < 0) return { level: bestLevel, p: 0, expected }
  return { level: bestLevel, p: bestP, expected }
}

export async function jevSentiment(text: string, opts: { tau?: number } = {}): Promise<JevSentiment> {
  const tau = opts.tau ?? 0.8
  const state = { text: text.slice(0, 20_000) }
  const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof score>> = {
    present: noul(
      'Does `text` express the WRITER\'s own emotion? Do not count a quoted speaker, another person\'s feeling, an emotion that is named and denied ("I\'m not angry"), or a topic\'s stereotypical mood. present=false is normal for flat or factual pages.',
      {
        true: 'The writer expresses their own feeling.',
        false: 'No writer emotion, or only someone else\'s / a denied emotion.',
      },
    ),
    valence: score(
      'How pleasant is the writer\'s own expressed emotion? Pleasantness, never goodness. If no writer emotion is present, choose mixed or neutral.',
      VALENCE_CRITERIA,
    ),
    activation: score(
      'How activated or urgent is the writer\'s own expressed emotion? Felt energy, never importance. If no writer emotion is present, choose still or depleted.',
      ACTIVATION_CRITERIA,
    ),
  }
  for (const emo of EMOTIONS) {
    questions[`emo_${emo}`] = noul(
      `Does the writer express ${emo} (${EMO_HINT[emo]}) as THEIR OWN feeling in \`text\`? First-person statements ("I felt…", "I was…") outrank inference. A negated mention ("I'm not ${emo}") is no. Another person's ${emo} is no.`,
      {
        true: `The writer expresses ${emo}.`,
        false: `The writer does not express ${emo}.`,
      },
    )
  }

  const { answers } = await askJev('jev_sentiment', state, questions)
  const presentNoul = answers.present && answers.present.type === 'noul' ? answers.present.noul : 0
  const present = presentNoul >= 0.5
  const valAns = answers.valence && answers.valence.type === 'score' ? answers.valence : undefined
  const actAns = answers.activation && answers.activation.type === 'score' ? answers.activation : undefined
  const val = argmaxScore(valAns, 2)
  const act = argmaxScore(actAns, 0)
  // Expected value stays on [-1, 1] for MAE; the bucket uses the argmax level.
  const valenceExpected = present ? (val.expected / 4) * 2 - 1 : 0
  const valence = valenceExpected
  const activation = present ? act.expected / 2 : 0
  const valenceLevel = present ? val.level : 2

  const emoProbs: Partial<Record<Emotion, number>> = {}
  const ranked: { emo: Emotion; p: number }[] = []
  for (const emo of EMOTIONS) {
    const ans = answers[`emo_${emo}`]
    const p = ans && ans.type === 'noul' ? ans.noul : 0
    emoProbs[emo] = p
    if (present && p >= 0.5) ranked.push({ emo, p })
  }
  ranked.sort((a, b) => b.p - a.p)
  const emotions = ranked.slice(0, 4).map((r) => r.emo)

  const noulConf = Math.max(presentNoul, 1 - presentNoul)
  const valP = val.p || (valAns && 'confidence' in valAns ? valAns.confidence : 0)
  const actP = act.p || (actAns && 'confidence' in actAns ? actAns.confidence : 0)
  const confidence = Math.min(valP || 1, actP || 1, noulConf)

  void tau
  return {
    present,
    valenceBucket: present ? bucketValenceLevel(val.level) : 'mixed',
    valence,
    valenceExpected,
    valenceLevel,
    activation,
    emotions,
    probs: {
      present: presentNoul,
      valence: val.expected,
      activation: act.expected,
      emotions: emoProbs,
    },
    confidence,
  }
}

export function sentimentNeedsLlm(reading: JevSentiment, tau: number): boolean {
  return reading.confidence < tau
}
