// Client for POST /api/ask — Remember's semantic pass.
//
// Ask is the slow half of Find/Ask: it needs the network (the question has to be
// embedded server-side, where the key lives) and it costs a model call. Find
// stays local and instant — see features/find/findLocal.ts. Nothing here runs
// on a keystroke; it fires only when the writer presses Return on a question.

import { apiPost } from './api'

export interface AskBeat {
  entry_id: string
  /** ISO timestamp of the entry the line came from. */
  date: string
  /** Where this sits in the sequence — "First", "The turn", "Most recent". */
  tag: string
  /** Verbatim from the entry. Server-side gated; never model-authored prose. */
  text: string
}

export interface AskFact {
  value: string
  label: string
}

export interface AskResult {
  question: string
  total: number
  span: { from: string; to: string } | null
  /** One count per calendar month from `span.from`, for the weather grid. */
  months: number[]
  facts: AskFact[]
  beats: AskBeat[]
  /** The Concordance entity the question touched, and every form of it searched. */
  expansion: { canonical: string; forms: string[] } | null
  legs: { vector: number; lexical: number }
  entryIds: string[]
}

/** Optional bounds for a date-anchored question ("when Dad was sick"). */
export interface AskRange {
  from?: string
  to?: string
}

export async function ask(q: string, range: AskRange = {}): Promise<AskResult> {
  const res = await apiPost<AskResult>('/api/ask', { q, ...range })
  return {
    ...res,
    months: res.months ?? [],
    facts: res.facts ?? [],
    beats: res.beats ?? [],
    entryIds: res.entryIds ?? [],
  }
}
