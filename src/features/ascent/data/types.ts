/**
 * THE ASCENT — the data seam's shared shapes.
 *
 * The redesign's core move: the SAME four dimensions persist across every
 * altitude (Your words · Scripture · Prayer-pattern · Learning-question) and
 * only change RESOLUTION as you climb. These view-models are what the dimension
 * components render — deliberately decoupled from the storage rows so a mock
 * adapter (prayer / learning / stones) can be swapped for a real one in one file
 * without touching the UI.
 *
 * Guardrails encoded in the types: Prayer is a *pattern*, never a list of
 * answered prayers; Learning is a *question* and is render-time only (no id to
 * persist, no save field); nothing carries a score, streak, or completion.
 */

import type { Lens } from './lenses'

export type { Lens } from './lenses'

/** The four altitudes, low → high. Higher = quieter, more distilled. */
export type Resolution = 'week' | 'month' | 'quarter' | 'year'

// ── Your words (REAL) ────────────────────────────────────────────────────────

/** A line of the user's own writing, always linking back to its source entry. */
export interface WordMoment {
  entryId: string
  dateLabel: string
  text: string
  /** true = a verbatim line the user kept; false = a clean reading excerpt. */
  isQuote: boolean
}

/** One verbatim line under a theme — links back to its source entry. */
export interface ThemeQuote {
  entryId: string
  /** YYYY-MM-DD, for ordering along the season. */
  date: string
  dateLabel: string
  text: string
}

/** A theme grounded in the writer's own words: a descriptive label over the
 *  verbatim quotes that share it. Surface = the label; drill = these quotes →
 *  the entry. The "intelligence highlights" layer. */
export interface Theme {
  id: string
  label: string
  quotes: ThemeQuote[]
}

/** A narrative movement of the period — "what you kept returning to". The richest
 *  reflection layer: a short name over a grounded note. */
export interface AscentArc {
  name: string
  note: string
}

export interface WordsData {
  resolution: Resolution
  periodLabel: string
  /** The arcs — the movements of the period ("what kept returning"). Primary. */
  arcs: AscentArc[]
  /** The highlight layer — themes grounded in verbatim quotes. May be empty (no
   *  synthesis yet); the dimension falls back to `moments` then. */
  themes: Theme[]
  /** week: entries in lived order · month: the lines kept · quarter: the phrases
   *  circled · year: the one line of the year. Fewer + more distilled as you climb. */
  moments: WordMoment[]
}

// ── Scripture (REAL) ───────────────────────────────────────────────────────────

export interface ScriptureRefItem {
  osisRef: string
  /** Formatted for display, e.g. "Romans 8:28". */
  label: string
  /** Distinct entries that reached for it (heat) — a mirror of affection, never a %. */
  count: number
}

export interface ScriptureData {
  resolution: Resolution
  periodLabel: string
  /** week: what you reached for · month: the recurring verse · quarter: the
   *  anchor passage · year: the verse of the year. */
  refs: ScriptureRefItem[]
  /** Faint, AI-inferred allusions awaiting the user's nod (the confirm funnel). */
  suggestedCount: number
}

// ── Prayer — PATTERN ONLY (MOCK) ───────────────────────────────────────────────
// Never a list of individual answered prayers — those live on the Wall.

export interface PrayerAsk {
  entryId: string | null
  dateLabel: string
  text: string
  /** A later entry that reads like first light on this ask (forward evidence). */
  evidence?: { entryId: string | null; dateLabel: string; text: string }
}

export interface PrayerData {
  resolution: Resolution
  /** The recurring ask in pattern form: "what you kept asking". */
  pattern: string
  asks: PrayerAsk[]
  /** Ebenezer (year only): the ask + the stone the user set. */
  ebenezer?: { ask: string; stone: string; entryId: string | null }
  /** True once a stone has been confirmed for this pattern (drives quiet UI only). */
  stoneSet: boolean
}

// ── Learning — QUESTION ONLY, RENDER-TIME ONLY (MOCK) ──────────────────────────
// Never persisted: no id, no save, no write-back. The app gathers; the user names.

export interface LearningFragment {
  lens: Lens
  /** A verbatim fragment in the user's own words. */
  text: string
  dateLabel: string
  entryId: string | null
}

export interface LearningData {
  resolution: Resolution
  /** Phrased as a question / "you started to see…" — never an answer or verdict. */
  question: string
  /** Cross-lens source moments — the convergence is the payoff. */
  fragments: LearningFragment[]
}

// ── Summit stones (MOCK) ───────────────────────────────────────────────────────

/** A stone the user has set on the Wall — a point of light along the mountainside. */
export interface SummitStone {
  /** 1–12; positions the stone along the climbed path. */
  month: number
  label: string
  entryId: string | null
}

// ── Composed per-altitude view model ───────────────────────────────────────────

export interface AltitudeData {
  resolution: Resolution
  words: WordsData | null
  scripture: ScriptureData | null
  /** null at the Valley (prayer-pattern begins at the Hillside). */
  prayer: PrayerData | null
  /** null at the Valley (learning begins at the Hillside). */
  learning: LearningData | null
}

/** The Summit adds the climbed-path stones and the year in view. */
export interface SummitView extends AltitudeData {
  year: number
  stones: SummitStone[]
}

export interface AscentData {
  week: AltitudeData
  month: AltitudeData
  quarter: AltitudeData
  year: SummitView
}
