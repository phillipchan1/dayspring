// Server-side copy of the rollup payload contract (§3). The client keeps its own
// copy in src/lib/insights.ts — they must stay in sync, but the server never
// imports from src/ (which would pull in VITE_ client env) and vice versa.

export type RollupType = 'weekly' | 'monthly' | 'yearly'

export interface Quote {
  entry_id: string
  date: string // YYYY-MM-DD
  text: string // verbatim substring of the entry body
}

export interface Facts {
  days_written: number
  days_in_period: number
  words: number
  longest_streak: number
  weeks_reflected: number | null
}

export interface Topic {
  label: string
  count: number
  entry_ids: string[]
}

export interface ObservationEvidence {
  topic: string
  count: number
  entry_ids: string[]
}

export interface Observation {
  text: string
  evidence: ObservationEvidence[]
}

export interface RollupPayload {
  period: { type: RollupType; start: string; end: string }
  quotes: Quote[]
  facts: Facts
  observation: Observation | null
  topics: Topic[]
  meta: { model: string; generated_at: string }
}

/** The raw JSON the model is asked to return (before server-side validation). */
export interface ModelOutput {
  quotes: Quote[]
  topics: Topic[]
  observation: Observation
}
