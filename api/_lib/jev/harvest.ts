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

const KIND_CRITERIA = {
  prayer:
    'The sentence is addressed TO God (You / Lord / Jesus / Father / Holy Spirit) — a petition, thanks, confession, praise, lament, or longing spoken to God. Writing ABOUT prayer is not a prayer. A quoted Scripture verse is not the writer\'s prayer. Other people\'s words are not the writer\'s prayer.',
  sense:
    'A clear FIRST-PERSON experience of God speaking, leading, comforting, convicting, or showing the writer something (e.g. "God said to me", "I felt the Lord leading me"). Ordinary "I feel" about mood or weather is not a sense.',
  neither:
    'Narration, plans, self-reflection, what God is doing for other people, passing mentions of church or faith, writing about prayer, quoted Scripture, or anything that is not the writer addressing God or receiving a personal sense.',
} as const

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
}

/** Shared with the eval dry-run so token estimates match the live payload. */
export function harvestQuestions(chunkTexts: string[]) {
  const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof choice>> = {
    contains_prayer: noul(
      'Does the writer address God directly anywhere in these sentences (a petition, thanks, confession, praise, or lament spoken TO God)? Writing about prayer, others\' prayers, or quoted Scripture is not a yes.',
      {
        true: 'At least one sentence is the writer speaking to God.',
        false: 'No sentence is addressed to God.',
      },
    ),
    contains_sense: noul(
      'Does the writer describe a first-person experience of God speaking, leading, comforting, convicting, or showing them something?',
      {
        true: 'A personal sense of God is present.',
        false: 'No personal sense of God.',
      },
    ),
  }
  for (let i = 0; i < chunkTexts.length; i++) {
    questions[`s${i}`] = choice(
      `Is \`sentences[${i}]\` a prayer addressed TO God, a first-person sense of God, or neither? Writing ABOUT prayer is neither. Quoted Scripture is neither. Other people's words are neither.`,
      KIND_CRITERIA,
    )
  }
  return questions
}

export function estimateHarvestTokens(sentences: Sentence[]): number {
  const texts = sentences.map((s) => s.text)
  return estimateJevTokens({ sentences: texts }, harvestQuestions(texts))
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

  return { byEntry, failed, failures, lowConfidence, gate, confidences }
}

async function harvestOne(
  entry: { id: string; body: string },
  tau: number,
): Promise<{
  passages: HarvestedPassage[]
  gate: { containsPrayer: boolean; containsSense: boolean; prayerNoul: number; senseNoul: number }
  confidences: number[]
  lowConfidence: boolean
}> {
  const source = writerWords(entry.body)
  const sentences = splitSentences(entry.body)
  const chunks = chunkForHarvest(sentences)
  const labels: SentenceLabel[] = []
  const confidences: number[] = []
  let prayerNoul = 0
  let senseNoul = 0

  for (const chunk of chunks) {
    const state = { sentences: chunk.map((s) => s.text) }
    const questions = harvestQuestions(state.sentences)

    const { answers } = await askJev(`jev_harvest:${entry.id}`, state, questions)
    const prayerAns = answers.contains_prayer
    const senseAns = answers.contains_sense
    if (prayerAns && prayerAns.type === 'noul') prayerNoul = Math.max(prayerNoul, prayerAns.noul)
    if (senseAns && senseAns.type === 'noul') senseNoul = Math.max(senseNoul, senseAns.noul)

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
  const lowConfidence = confidences.some((c) => c < tau)
  return {
    passages: merged,
    gate: {
      containsPrayer: prayerNoul >= NOUL_YES,
      containsSense: senseNoul >= NOUL_YES,
      prayerNoul,
      senseNoul,
    },
    confidences,
    lowConfidence,
  }
}
