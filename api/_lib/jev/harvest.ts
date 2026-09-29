/**
 * Jev prayer/sense harvest — same seam as harvestTexts in altar.ts.
 * Code splits sentences; Jev only labels. Spans stay verbatim by construction.
 */

import { choice, noul } from '@typesafe-ai/sdk'
import { writerWords } from '../writerWords.js'
import { askJev, estimateJevTokens } from '../typesafe.js'
import type { HarvestedPassage } from '../altar.js'
import {
  chunkByTokenBudget,
  mergeSpans,
  splitSentences,
  type Sentence,
  type SentenceLabel,
} from './sentences.js'

const PER_ENTRY_CAP = 5
const NOUL_YES = 0.5

/** Shared once on `state` — the TypeSafe request has no top-level context field. */
export const KIND_RUBRIC = {
  prayer:
    'The sentence is addressed TO God (You / Lord / Jesus / Father / Holy Spirit) — a petition, thanks, confession, praise, lament, or longing spoken to God. Writing ABOUT prayer is not a prayer. A quoted Scripture verse is not the writer\'s prayer. Other people\'s words are not the writer\'s prayer.',
  sense:
    'A clear FIRST-PERSON experience of God speaking, leading, comforting, convicting, or showing the writer something (e.g. "God said to me", "I felt the Lord leading me"). Ordinary "I feel" about mood or weather is not a sense.',
  neither:
    'Narration, plans, self-reflection, what God is doing for other people, passing mentions of church or faith, writing about prayer, quoted Scripture, or anything that is not the writer addressing God or receiving a personal sense.',
} as const

const SHORT_KIND = {
  prayer: 'See kind_rubric.prayer — addressed TO God.',
  sense: 'See kind_rubric.sense — first-person sense of God.',
  neither: 'See kind_rubric.neither.',
} as const

export function noulCertainty(n: number): number {
  return Math.max(n, 1 - n)
}

/** Sentence-label only when the entry gate is yes, or the gate itself is below τ. */
export function needsSentenceHarvest(
  gate: { prayerNoul: number; senseNoul: number },
  tau: number,
): boolean {
  if (gate.prayerNoul >= NOUL_YES || gate.senseNoul >= NOUL_YES) return true
  return noulCertainty(gate.prayerNoul) < tau || noulCertainty(gate.senseNoul) < tau
}

export interface HarvestFailure {
  id: string
  status?: number
  code?: string
  message: string
}

export interface JevHarvestResult {
  byEntry: Map<string, HarvestedPassage[]>
  failed: string[]
  failures: HarvestFailure[]
  lowConfidence: string[]
  /** Entry-level gate from the contains_prayer Noul (yes if noul ≥ 0.5). */
  gate: Map<string, { containsPrayer: boolean; containsSense: boolean; prayerNoul: number; senseNoul: number }>
  /** Per-sentence confidence, for cascade / calibration. */
  confidences: Map<string, number[]>
  /** Entries whose sentence pass was skipped after a confident-negative gate. */
  skippedSentences: string[]
}

export function gateQuestions() {
  return {
    contains_prayer: noul(
      'Does the writer address God directly anywhere in `text` (a petition, thanks, confession, praise, or lament spoken TO God)? Writing about prayer, others\' prayers, or quoted Scripture is not a yes.',
      {
        true: 'At least one sentence is the writer speaking to God.',
        false: 'No sentence is addressed to God.',
      },
    ),
    contains_sense: noul(
      'Does the writer describe a first-person experience of God speaking, leading, comforting, convicting, or showing them something in `text`?',
      {
        true: 'A personal sense of God is present.',
        false: 'No personal sense of God.',
      },
    ),
  }
}

export function harvestState(chunkTexts: string[]) {
  return { sentences: chunkTexts, kind_rubric: KIND_RUBRIC }
}

/** Per-sentence questions. Criteria live once on `state.kind_rubric` (no request-level context field). */
export function harvestQuestions(chunkTexts: string[]) {
  const questions: Record<string, ReturnType<typeof choice>> = {}
  for (let i = 0; i < chunkTexts.length; i++) {
    questions[`s${i}`] = choice(
      `Using \`kind_rubric\`, is \`sentences[${i}]\` prayer, sense, or neither?`,
      SHORT_KIND,
    )
  }
  return questions
}

export function estimateGateTokens(body: string): number {
  return estimateJevTokens({ text: writerWords(body).slice(0, 20_000) }, gateQuestions())
}

export function estimateHarvestTokens(sentences: Sentence[]): number {
  const texts = sentences.map((s) => s.text)
  return estimateJevTokens(harvestState(texts), harvestQuestions(texts))
}

export function chunkForHarvest(sentences: Sentence[]): Sentence[][] {
  return chunkByTokenBudget(sentences, estimateHarvestTokens)
}

export function harvestFailureFrom(err: unknown, id: string): HarvestFailure {
  const status =
    err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined
  const body = err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : undefined
  const message = err instanceof Error ? err.message : String(err)
  return { id, status, code: extractErrorCode(body, message), message }
}

function extractErrorCode(body: unknown, message: string): string | undefined {
  if (typeof body === 'string') {
    return /[a-z][a-z0-9_]{2,}/.exec(body)?.[0]
  }
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>
    if (typeof rec.code === 'string') return rec.code
    if (typeof rec.error === 'string') return rec.error
    if (rec.error && typeof rec.error === 'object') {
      const inner = rec.error as Record<string, unknown>
      if (typeof inner.code === 'string') return inner.code
      if (typeof inner.type === 'string') return inner.type
    }
  }
  return /max_tokens_exceeded|[a-z]+(?:_[a-z]+)+/.exec(message)?.[0]
}

export async function jevHarvestTexts(
  entries: { id: string; body: string }[],
  opts: { tau?: number } = {},
): Promise<JevHarvestResult> {
  const tau = opts.tau ?? 0.8
  const byEntry = new Map<string, HarvestedPassage[]>()
  const failed: string[] = []
  const failures: HarvestFailure[] = []
  const lowConfidence: string[] = []
  const skippedSentences: string[] = []
  const gate = new Map<
    string,
    { containsPrayer: boolean; containsSense: boolean; prayerNoul: number; senseNoul: number }
  >()
  const confidences = new Map<string, number[]>()

  for (const entry of entries) {
    try {
      const result = await harvestOne(entry, tau)
      if (result.passages.length) byEntry.set(entry.id, result.passages)
      gate.set(entry.id, result.gate)
      confidences.set(entry.id, result.confidences)
      if (result.lowConfidence) lowConfidence.push(entry.id)
      if (result.skippedSentences) skippedSentences.push(entry.id)
    } catch (err) {
      const failure = harvestFailureFrom(err, entry.id)
      failed.push(entry.id)
      failures.push(failure)
      console.warn(
        `[jev-harvest] ${entry.id} failed` +
          `${failure.status != null ? ` HTTP ${failure.status}` : ''}` +
          `${failure.code ? ` ${failure.code}` : ''}: ${failure.message}`,
      )
    }
  }

  return { byEntry, failed, failures, lowConfidence, gate, confidences, skippedSentences }
}

async function harvestOne(
  entry: { id: string; body: string },
  tau: number,
): Promise<{
  passages: HarvestedPassage[]
  gate: { containsPrayer: boolean; containsSense: boolean; prayerNoul: number; senseNoul: number }
  confidences: number[]
  lowConfidence: boolean
  skippedSentences: boolean
}> {
  const source = writerWords(entry.body)
  const { answers: gateAns } = await askJev(
    `jev_harvest_gate:${entry.id}`,
    { text: source.slice(0, 20_000) },
    gateQuestions(),
  )
  const prayerNoul = gateAns.contains_prayer?.type === 'noul' ? gateAns.contains_prayer.noul : 0
  const senseNoul = gateAns.contains_sense?.type === 'noul' ? gateAns.contains_sense.noul : 0
  const gate = {
    containsPrayer: prayerNoul >= NOUL_YES,
    containsSense: senseNoul >= NOUL_YES,
    prayerNoul,
    senseNoul,
  }
  const gateLow = noulCertainty(prayerNoul) < tau || noulCertainty(senseNoul) < tau

  if (!needsSentenceHarvest(gate, tau)) {
    return { passages: [], gate, confidences: [], lowConfidence: false, skippedSentences: true }
  }

  const sentences = splitSentences(entry.body)
  const chunks = chunkForHarvest(sentences)
  const labels: SentenceLabel[] = []
  const confidences: number[] = []

  for (const chunk of chunks) {
    const texts = chunk.map((s) => s.text)
    const { answers } = await askJev(`jev_harvest:${entry.id}`, harvestState(texts), harvestQuestions(texts))

    for (let i = 0; i < chunk.length; i++) {
      const ans = answers[`s${i}`]
      if (!ans || ans.type !== 'choice') {
        labels.push('neither')
        confidences.push(0)
        continue
      }
      const kind = ans.choice
      labels.push(kind === 'prayer' || kind === 'sense' ? kind : 'neither')
      confidences.push(ans.confidence)
    }
  }

  const merged = mergeSpans(sentences, labels, source).slice(0, PER_ENTRY_CAP)
  const lowConfidence = gateLow || confidences.some((c) => c < tau)
  return { passages: merged, gate, confidences, lowConfidence, skippedSentences: false }
}
