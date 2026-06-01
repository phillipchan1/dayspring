/**
 * Looking Back — the reflection content model + live data loader.
 *
 * The two engines that produce this content live SERVER-SIDE (api/_lib): the
 * Insight Layer synthesizes the prose, Reflective Prompting writes the questions,
 * and both run over the rollup cascade (week→month→quarter→year, each reading the
 * level beneath). The job writes a `reflection` block into insights.structured_payload.
 *
 * This module is the read side: `loadReflection(horizon)` fetches the latest
 * rollup of the matching type and maps its payload into the typed UI shapes
 * below. Legacy rows without a `reflection` block fall back to the older
 * quotes/observation/topics fields so nothing breaks.
 */

import {
  listRollups,
  type Rollup,
  type RollupType,
  type Excerpt as PayloadExcerpt,
  type EbenezerPair as PayloadPair,
} from '@/lib/insights'

export type Horizon = 'week' | 'month' | 'quarter' | 'year'

/** Lenses that color synthesis + prompting (configured server-side for now). */
export type Lens = 'gain' | 'gratitude' | 'spiritual' | 'work' | 'trading' | 'family'

/** A resurfaced excerpt in the user's OWN words — tappable to open in Read. */
export interface Excerpt {
  entryId: string
  date: string
  text: string
}

/** Reflective-Prompting output. The AI asks, never answers. Always dismissible. */
export interface Question {
  id: string
  text: string
  addressee: 'self' | 'God'
}

/** One atomic win. `suggested` = AI candidate not yet edited/confirmed. */
export interface Win {
  id: string
  text: string
  suggested: boolean
}

/** The verdict the USER assigns an Ebenezer pairing. The AI never marks this. */
export type EbenezerMark = 'unmarked' | 'answered' | 'not_yet' | 'no'

/** An earlier ask set beside a later moment; the user decides the verdict. */
export interface EbenezerStone {
  id: string
  ask: Excerpt
  later: Excerpt
  mark: EbenezerMark
}

export interface Prose {
  paragraphs: string[]
}

export interface WeeklyReflection {
  horizon: 'week'
  periodLabel: string
  synthesis: Prose
  citations: Excerpt[]
  wins: { thisWeek: Win[]; nextWeek: Win[] }
  jumpstart: Question[]
}

export interface MonthlyReflection {
  horizon: 'month'
  periodLabel: string
  letter: Prose
  gain: Prose
  gainEvidence: Excerpt[]
  gapWatch?: string
  themes: Prose
}

export interface QuarterlyReflection {
  horizon: 'quarter'
  periodLabel: string
  synthesis: Prose
  jumpstart: Question[]
  ebenezer: EbenezerStone[]
}

export interface YearlyReflection {
  horizon: 'year'
  periodLabel: string
  throughline: Prose
  stones: EbenezerStone[]
  themes: Prose
}

export type Reflection =
  | WeeklyReflection
  | MonthlyReflection
  | QuarterlyReflection
  | YearlyReflection

const HORIZON_TYPE: Record<Horizon, RollupType> = {
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
  year: 'yearly',
}

// ── structured_payload write seams (persisted server-side later) ────────────

/**
 * TODO(structured-payload): persist a `win` record to insights.structured_payload
 * (PATCH the owning rollup). No-op for now so the inline editor has a real seam.
 */
export function recordWin(_winId: string, _text: string): void {
  // wired to Supabase later
}

/**
 * TODO(structured-payload): persist an `answered` record when the user marks an
 * Ebenezer stone; the cockpit routes confirmed marks. No-op stub for now.
 */
export function recordEbenezerMark(_stoneId: string, _mark: EbenezerMark): void {
  // wired to Supabase later
}

// ── mapping: live payload → UI shapes ───────────────────────────────────────

function mapExcerpt(e: PayloadExcerpt): Excerpt {
  return { entryId: e.entry_id, date: e.date, text: e.text }
}

function mapStone(p: PayloadPair, mark: EbenezerMark): EbenezerStone {
  return { id: p.id, ask: mapExcerpt(p.ask), later: mapExcerpt(p.later), mark }
}

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function periodLabel(r: Rollup): string {
  const { type, period_start, period_end } = r
  const startD = new Date(`${period_start}T00:00:00Z`)
  if (type === 'monthly') {
    return startD.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  if (type === 'yearly') return String(startD.getUTCFullYear())
  if (type === 'quarterly') {
    const q = Math.floor(startD.getUTCMonth() / 3) + 1
    return `Q${q} ${startD.getUTCFullYear()}`
  }
  return `${fmtDay(period_start)} – ${fmtDay(period_end)}`
}

/** A facts-free fallback when a legacy row has no generated prose. */
function legacyTopicsLine(r: Rollup): string[] {
  const topics = r.payload.topics ?? []
  if (topics.length === 0) return []
  const names = topics.slice(0, 3).map((t) => t.label)
  return [`You kept returning to ${names.join(', ')}.`]
}

function buildReflection(horizon: Horizon, r: Rollup): Reflection {
  const rc = r.payload.reflection
  const obs = r.payload.observation?.text?.trim()
  const quoteExcerpts = (r.payload.quotes ?? []).map((q) => mapExcerpt(q))
  const label = periodLabel(r)

  switch (horizon) {
    case 'week':
      return {
        horizon: 'week',
        periodLabel: label,
        synthesis: { paragraphs: rc?.synthesis ?? (obs ? [obs] : []) },
        citations: (rc?.citations ?? []).map(mapExcerpt).concat(rc ? [] : quoteExcerpts),
        wins: {
          thisWeek: (rc?.wins?.thisWeek ?? []).map((w) => ({ ...w, suggested: true })),
          nextWeek: (rc?.wins?.nextWeek ?? []).map((w) => ({ ...w, suggested: true })),
        },
        jumpstart: rc?.questions ?? [],
      }
    case 'month':
      return {
        horizon: 'month',
        periodLabel: label,
        letter: { paragraphs: rc?.letter ?? (obs ? [obs] : []) },
        gain: { paragraphs: rc?.gain ?? [] },
        gainEvidence: (rc?.gainEvidence ?? []).map(mapExcerpt).concat(rc ? [] : quoteExcerpts),
        ...(rc?.gapWatch ? { gapWatch: rc.gapWatch } : {}),
        themes: { paragraphs: rc?.themes ?? legacyTopicsLine(r) },
      }
    case 'quarter':
      return {
        horizon: 'quarter',
        periodLabel: label,
        synthesis: { paragraphs: rc?.synthesis ?? [] },
        jumpstart: rc?.questions ?? [],
        ebenezer: (rc?.ebenezer ?? []).map((p) => mapStone(p, 'unmarked')),
      }
    case 'year':
      return {
        horizon: 'year',
        periodLabel: label,
        throughline: { paragraphs: rc?.throughline ?? [] },
        stones: (rc?.stones ?? []).map((p) => mapStone(p, 'answered')),
        themes: { paragraphs: rc?.themes ?? legacyTopicsLine(r) },
      }
  }
}

/**
 * Load the latest reflection for a horizon. Returns null when no rollup of that
 * type exists yet (the UI shows a graceful "still gathering" state).
 */
export async function loadReflection(horizon: Horizon): Promise<Reflection | null> {
  const rollups = await listRollups(HORIZON_TYPE[horizon])
  const latest = rollups[0]
  return latest ? buildReflection(horizon, latest) : null
}
