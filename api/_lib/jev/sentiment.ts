/**
 * Jev sentiment — closed label set matching keepingRead.ts EMOTIONS.
 * Lab only; not wired into api/keeping/read.ts.
 *
 * Variants (compose with `+` or `,`): baseline | tight | denial | thresholds |
 * writer | primary | v2. See parseSentimentVariant.
 */

import { choice, noul, score } from '@typesafe-ai/sdk'
import { EMOTIONS, type Emotion } from '../keepingRead.js'
import { askJev, estimateJevTokens } from '../typesafe.js'
import {
  DEFAULT_EMOTION_THRESHOLD,
  DENIAL_CANDIDATE_FLOOR,
  finalizeEmotions,
  type FittedEmotionThresholds,
} from './sentimentThresholds.js'

export type ValenceBucket = 'negative' | 'mixed' | 'positive'

export const SENTIMENT_VARIANT_TOKENS = [
  'baseline',
  'tight',
  'denial',
  'thresholds',
  'writer',
  'primary',
  'v2',
] as const

export type SentimentVariantToken = (typeof SENTIMENT_VARIANT_TOKENS)[number]

export interface SentimentVariant {
  wording: 'baseline' | 'tight'
  denial: boolean
  thresholds: boolean
  writerOnly: boolean
  primary: boolean
  raw: string
}

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
  /** Emotions dropped by the denial Noul (empty when the variant omits denial). */
  denied: Emotion[]
  /** Multi-choice primary emotion, when requested. */
  primary: Emotion | 'none' | null
  primaryConfidence: number
  variant: string
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

/** Baseline hints (the wording that produced the 150-entry A/B). */
export const EMO_HINT: Record<Emotion, string> = {
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

/** Short definitions used by the tight wording variant. */
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

export const SENTIMENT_RULES_TIGHT =
  `Count only the writer's own felt emotion. Do not count: ${EXCLUSION}.`

export const SENTIMENT_RULES_WRITER =
  'Ask only about the writer\'s own first-person feeling. Do not infer from events, weather, or what this situation typically feels like. If the page is facts without "I feel / I am / I was", present is no.'

const PRIMARY_CRITERIA: Record<string, string> = {
  none: 'No writer emotion, or only a denied / other-person / mentioned emotion.',
  joy: EMO_DEF.joy,
  peace: EMO_DEF.peace,
  gratitude: EMO_DEF.gratitude,
  hope: EMO_DEF.hope,
  love: EMO_DEF.love,
  longing: EMO_DEF.longing,
  sadness: EMO_DEF.sadness,
  grief: EMO_DEF.grief,
  fear: EMO_DEF.fear,
  anger: EMO_DEF.anger,
  shame: EMO_DEF.shame,
  confusion: EMO_DEF.confusion,
  weariness: EMO_DEF.weariness,
  stress: EMO_DEF.stress,
}

export function parseSentimentVariant(raw?: string): SentimentVariant {
  const source = (raw ?? 'baseline').trim()
  const tokens = source
    .split(/[+,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const unknown = tokens.filter((t) => !(SENTIMENT_VARIANT_TOKENS as readonly string[]).includes(t))
  if (unknown.length) {
    throw new Error(
      `--sentiment-variant unknown token(s): ${unknown.join(', ')}. Use ${SENTIMENT_VARIANT_TOKENS.join(' | ')}`,
    )
  }
  if (tokens.includes('v2')) {
    return {
      wording: 'tight',
      denial: true,
      thresholds: true,
      writerOnly: true,
      primary: true,
      raw: source || 'v2',
    }
  }
  return {
    wording: tokens.includes('tight') ? 'tight' : 'baseline',
    denial: tokens.includes('denial'),
    thresholds: tokens.includes('thresholds'),
    writerOnly: tokens.includes('writer'),
    primary: tokens.includes('primary'),
    raw: source || 'baseline',
  }
}

export function formatSentimentVariant(v: SentimentVariant): string {
  if (v.raw === 'v2' || (v.wording === 'tight' && v.denial && v.thresholds && v.writerOnly && v.primary)) {
    return v.raw.includes('v2') ? 'v2' : 'tight+denial+thresholds+writer+primary'
  }
  const parts: string[] = [v.wording]
  if (v.denial) parts.push('denial')
  if (v.thresholds) parts.push('thresholds')
  if (v.writerOnly) parts.push('writer')
  if (v.primary) parts.push('primary')
  return parts.join('+')
}

export function sentimentState(text: string, variant: SentimentVariant): Record<string, string> {
  const state: Record<string, string> = { text: text.slice(0, 20_000) }
  const rules: string[] = []
  if (variant.wording === 'tight') rules.push(SENTIMENT_RULES_TIGHT)
  if (variant.writerOnly) rules.push(SENTIMENT_RULES_WRITER)
  if (rules.length) state.rules = rules.join(' ')
  return state
}

function presentQuestion(variant: SentimentVariant) {
  if (variant.writerOnly) {
    return noul(
      'Does `text` state the WRITER\'s own felt emotion in first person? Follow `rules`. Do not infer from events, weather, or what this situation typically feels like. A page of facts with no "I feel / I am / I was" is no. Denied emotions ("I\'m not angry") and other people\'s feelings are no.',
      {
        true: 'The writer states their own feeling.',
        false: 'No first-person writer emotion — inferred, denied, someone else\'s, or absent.',
      },
    )
  }
  if (variant.wording === 'tight') {
    return noul(
      `Does \`text\` contain the WRITER's own felt emotion? Follow \`rules\`. YES only if they themselves feel it. NO if: ${EXCLUSION}. present=false is normal for flat or factual pages.`,
      {
        true: 'The writer expresses their own feeling.',
        false: 'No writer emotion, or only a mention / denial / someone else\'s feeling.',
      },
    )
  }
  return noul(
    'Does `text` express the WRITER\'s own emotion? Do not count a quoted speaker, another person\'s feeling, an emotion that is named and denied ("I\'m not angry"), or a topic\'s stereotypical mood. present=false is normal for flat or factual pages.',
    {
      true: 'The writer expresses their own feeling.',
      false: 'No writer emotion, or only someone else\'s / a denied emotion.',
    },
  )
}

function valenceQuestion(variant: SentimentVariant) {
  const inferred =
    variant.writerOnly || variant.wording === 'tight'
      ? ' Score only the feeling they express, not what the events imply.'
      : ''
  return score(
    `How pleasant is the writer's own expressed emotion? Pleasantness, never goodness.${inferred} If no writer emotion is present, choose mixed or neutral.`,
    VALENCE_CRITERIA,
  )
}

function activationQuestion(variant: SentimentVariant) {
  const inferred =
    variant.writerOnly || variant.wording === 'tight'
      ? ' Score felt energy they express, not the importance of the events.'
      : ''
  return score(
    `How activated or urgent is the writer's own expressed emotion? Felt energy, never importance.${inferred} If no writer emotion is present, choose still or depleted.`,
    ACTIVATION_CRITERIA,
  )
}

function emotionQuestion(emo: Emotion, variant: SentimentVariant) {
  if (variant.wording === 'tight' || variant.writerOnly) {
    const own = variant.writerOnly
      ? ' the writer THEMSELVES, in first person,'
      : ' the writer THEMSELVES'
    return noul(
      `Does${own} feel ${emo} as their own emotion in \`text\`? Definition: ${EMO_DEF[emo]}. Follow \`rules\`. YES only if they are feeling it. NO if: they mention the word without feeling it; they negate or deny it ("I'm not ${emo}", "I don't feel ${emo}"); the feeling belongs to someone else; it is a quote, lyric, or topic.`,
      {
        true: `The writer feels ${emo}.`,
        false: `The writer does not feel ${emo} (absent, mentioned, denied, or someone else's).`,
      },
    )
  }
  return noul(
    `Does the writer express ${emo} (${EMO_HINT[emo]}) as THEIR OWN feeling in \`text\`? First-person statements ("I felt…", "I was…") outrank inference. A negated mention ("I'm not ${emo}") is no. Another person's ${emo} is no.`,
    {
      true: `The writer expresses ${emo}.`,
      false: `The writer does not express ${emo}.`,
    },
  )
}

export function buildSentimentQuestions(variant: SentimentVariant): Record<string, ReturnType<typeof noul> | ReturnType<typeof score> | ReturnType<typeof choice>> {
  const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof score> | ReturnType<typeof choice>> = {
    present: presentQuestion(variant),
    valence: valenceQuestion(variant),
    activation: activationQuestion(variant),
  }
  for (const emo of EMOTIONS) {
    questions[`emo_${emo}`] = emotionQuestion(emo, variant)
  }
  if (variant.primary) {
    questions.primary = choice(
      'What is the writer\'s PRIMARY own emotion in `text`? One label. If they express no own emotion — or only a denied, mentioned, or other-person emotion — choose none. Follow `rules` when present.',
      PRIMARY_CRITERIA,
    )
  }
  return questions
}

export function buildDenialQuestions(emotions: readonly Emotion[]): Record<string, ReturnType<typeof noul>> {
  const questions: Record<string, ReturnType<typeof noul>> = {}
  for (const emo of emotions) {
    questions[`deny_${emo}`] = noul(
      `Is the writer denying or negating feeling ${emo} in \`text\`? YES if they say they do not feel it ("I'm not ${emo}", "I don't feel ${emo}", "not ${emo}, just tired"). NO if they are feeling ${emo} or the page does not mention ${emo} as a denial.`,
      {
        true: `The writer is denying or negating ${emo}.`,
        false: `The writer is not denying ${emo}.`,
      },
    )
  }
  return questions
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

export function estimateSentimentTokens(text: string, variant: SentimentVariant): number {
  const state = sentimentState(text, variant)
  const questions = buildSentimentQuestions(variant)
  let n = estimateJevTokens(state, questions)
  if (variant.denial) {
    n += estimateJevTokens(state, buildDenialQuestions(['anger', 'sadness']))
  }
  return n
}

export interface JevSentimentOpts {
  tau?: number
  variant?: SentimentVariant | string
  thresholds?: FittedEmotionThresholds | null
}

export async function jevSentiment(text: string, opts: JevSentimentOpts = {}): Promise<JevSentiment> {
  const tau = opts.tau ?? 0.8
  const variant = typeof opts.variant === 'string' || opts.variant === undefined
    ? parseSentimentVariant(typeof opts.variant === 'string' ? opts.variant : 'baseline')
    : opts.variant
  const state = sentimentState(text, variant)
  const questions = buildSentimentQuestions(variant)
  const { answers } = await askJev('jev_sentiment', state, questions)

  const presentNoul = answers.present && answers.present.type === 'noul' ? answers.present.noul : 0
  const present = presentNoul >= 0.5
  const valAns = answers.valence && answers.valence.type === 'score' ? answers.valence : undefined
  const actAns = answers.activation && answers.activation.type === 'score' ? answers.activation : undefined
  const val = argmaxScore(valAns, 2)
  const act = argmaxScore(actAns, 0)
  const valenceExpected = present ? (val.expected / 4) * 2 - 1 : 0
  const valence = valenceExpected
  const activation = present ? act.expected / 2 : 0
  const valenceLevel = present ? val.level : 2

  const emoProbs: Partial<Record<Emotion, number>> = {}
  for (const emo of EMOTIONS) {
    const ans = answers[`emo_${emo}`]
    emoProbs[emo] = ans && ans.type === 'noul' ? ans.noul : 0
  }

  let primary: Emotion | 'none' | null = null
  let primaryConfidence = 0
  if (variant.primary) {
    const pAns = answers.primary
    if (pAns && pAns.type === 'choice') {
      const label = pAns.choice
      primaryConfidence = pAns.confidence ?? 0
      if (label === 'none') primary = 'none'
      else if ((EMOTIONS as readonly string[]).includes(label)) primary = label as Emotion
    }
  }

  const candidates = EMOTIONS.filter((emo) => (emoProbs[emo] ?? 0) >= DENIAL_CANDIDATE_FLOOR)
  const denied: Emotion[] = []
  if (variant.denial && candidates.length) {
    const denyQs = buildDenialQuestions(candidates)
    const deny = await askJev('jev_sentiment_denial', state, denyQs)
    for (const emo of candidates) {
      const ans = deny.answers[`deny_${emo}`]
      const p = ans && ans.type === 'noul' ? ans.noul : 0
      if (p >= 0.5) denied.push(emo)
    }
  }

  const emotions = finalizeEmotions({
    present,
    probs: emoProbs,
    denied,
    primary,
    thresholds: opts.thresholds,
    defaultThreshold: DEFAULT_EMOTION_THRESHOLD,
  })

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
    denied,
    primary,
    primaryConfidence,
    variant: formatSentimentVariant(variant),
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
