// Client-side reads of the grounded rollups. The owner reads their own rows via
// the normal anon client + RLS (auth.uid() = owner). The client NEVER writes
// insights — generation happens server-side with the service-role key.

import { requireSupabase } from './supabase'

export type RollupType = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Quote {
  entry_id: string
  date: string // YYYY-MM-DD
  text: string
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

// Rich "Looking Back" content. Mirrors api/_lib/types.ts ReflectionContent.
// Prose fields are generated; excerpt-bearing fields are verbatim-validated.
export interface Excerpt {
  entry_id: string
  date: string
  text: string
}
export interface EbenezerPair {
  id: string
  ask: Excerpt
  later: Excerpt
}
export interface ReflectionQuestion {
  id: string
  text: string
  addressee: 'self' | 'God'
}
export interface WinCandidate {
  id: string
  text: string
}
export interface ReflectionContent {
  synthesis?: string[]
  letter?: string[]
  gain?: string[]
  gapWatch?: string
  themes?: string[]
  throughline?: string[]
  citations?: Excerpt[]
  gainEvidence?: Excerpt[]
  ebenezer?: EbenezerPair[]
  stones?: EbenezerPair[]
  questions?: ReflectionQuestion[]
  wins?: { thisWeek: WinCandidate[]; nextWeek: WinCandidate[] }
}

/** The §3 contract stored in insights.structured_payload. */
export interface RollupPayload {
  period: { type: RollupType; start: string; end: string }
  quotes: Quote[]
  facts: Facts
  observation: Observation | null
  topics: Topic[]
  /** id → "Title (Apr 7)" for human-readable observation copy. */
  entry_labels?: Record<string, string>
  /** Rich Looking Back content; absent on legacy rows. */
  reflection?: ReflectionContent
  meta: { model: string; generated_at: string }
}

export interface Rollup {
  id: string
  type: RollupType
  period_start: string
  period_end: string
  source_ids: string[]
  payload: RollupPayload
}

interface InsightRow {
  id: string
  type: RollupType
  period_start: string
  period_end: string
  source_ids: string[] | null
  structured_payload: RollupPayload
}

function toRollup(row: InsightRow): Rollup {
  return {
    id: row.id,
    type: row.type,
    period_start: row.period_start,
    period_end: row.period_end,
    source_ids: row.source_ids ?? [],
    payload: row.structured_payload,
  }
}

/** Rollups of a given type, newest period first. */
export async function listRollups(type: RollupType): Promise<Rollup[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('insights')
    .select('id, type, period_start, period_end, source_ids, structured_payload')
    .eq('type', type)
    .order('period_start', { ascending: false })
  if (error) throw error
  return ((data ?? []) as InsightRow[]).map(toRollup)
}

/** One rollup by type + period start (the period switcher's key). */
export async function getRollup(type: RollupType, periodStart: string): Promise<Rollup | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('insights')
    .select('id, type, period_start, period_end, source_ids, structured_payload')
    .eq('type', type)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (error) throw error
  return data ? toRollup(data as InsightRow) : null
}
