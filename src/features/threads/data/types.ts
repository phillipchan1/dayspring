/** 0=week · 1=month · 2=season · 3=year · 4=all time */
export type Horizon = 0 | 1 | 2 | 3 | 4

export type Register = 'bringing' | 'meeting' | 'neutral'

/**
 * How a strand entered the field.
 *   declared — the writer marked it (/pray, /sense): a deliberate object.
 *   derived  — the app wove it from recurring prose: a noticed pattern.
 * Orthogonal to the structural rope|thread shape (FieldItem.kind).
 */
export type StrandKind = 'declared' | 'derived'

/** Declared-thread subtype. null for derived/none. The "Altar" lens filters on this. */
export type StrandType = 'prayer' | 'sense' | null

/** A row shown on the field — may be a rope (group of threads) or a standalone thread. */
export interface FieldItem {
  id: string
  kind: 'rope' | 'thread'
  /** Prefer label_user; fall back to label_ai; fall back to label. */
  label: string
  domain: string | null
  lens: string | null
  spanStart: string
  spanEnd: string
  weight: number
  /** 0–1 recency score. */
  temperature: number
  private: boolean
  /** For ropes: number of component threads. For threads: 1. */
  threadCount: number
  /** declared (marked /pray, /sense) vs derived (woven from prose). Phase 2+ populated. */
  strandKind?: StrandKind
  /** prayer | sense | null — drives the Altar lens filter. Phase 2+ populated. */
  type?: StrandType
}

/** A thread row inside a rope decompose view. */
export interface ThreadItem {
  id: string
  label: string
  lens: string | null
  spanStart: string
  spanEnd: string
  weight: number
}

/** One moment on the tended timeline. */
export interface MomentItem {
  entryId: string
  date: string         // ISO date string (entry_created_at)
  register: Register
  /** First meaningful excerpt from the entry body — verbatim, never rewritten. */
  excerpt: string
}

/** Full thread detail including timeline members. */
export interface ThreadDetail {
  id: string
  label: string
  lens: string | null
  spanStart: string
  spanEnd: string
  /** Deterministic reframe line — template, not LLM generated. */
  reframe: string
  moments: MomentItem[]
}

/** A representative member line selected (never synthesized) for a horizon. */
export interface RepLine {
  entryId: string
  date: string         // ISO (entry_created_at)
  excerpt: string      // verbatim slice of the entry body
}

/**
 * A rope or standalone thread rendered as an abstract warmth band, with its
 * state windowed up to a horizon. Pure aggregation of thread_members — no
 * counts surface in the UI; heft drives thickness/saturation, felt not numbered.
 */
export interface WarmthBand {
  id: string
  kind: 'rope' | 'thread'
  /** label_user ?? label_ai ?? label. */
  label: string
  private: boolean
  /** # member entries within the window (cumulative as the window widens). */
  heft: number
  /** Distinct lenses among the windowed members' threads — drives hue blend. */
  lenses: string[]
  /** Sub-period buckets over the window, each 0–1 relative density — glow pools. */
  pools: number[]
  /** Most-central windowed member (temporal median). Selection, not generation. */
  repLine: RepLine | null
  spanStart: string
  spanEnd: string
  /** declared (marked /pray, /sense) vs derived (woven from prose). Phase 2+ populated. */
  strandKind?: StrandKind
  /** prayer | sense | null — drives the Altar lens filter. Phase 2+ populated. */
  type?: StrandType
}

/**
 * A band's full tended life (NOT windowed) — the click-in view. The band's own
 * encoding (heft/lenses/pools over its whole span) reappears small at the top to
 * confirm itself, then its moments resolve down to the source entries.
 */
export interface BandTended {
  id: string
  kind: 'rope' | 'thread'
  label: string
  lenses: string[]
  heft: number
  pools: number[]
  /** Deterministic reframe line — template, not LLM. */
  reframe: string
  moments: MomentItem[]
}

/** Source entry for the deepest drill level. */
export interface EntryDetail {
  id: string
  date: string
  title: string
  body: string
}

// ── legacy types (kept for mock fixtures compat) ───────────────────────────

export interface Moment {
  date: string
  prose: string
  entryId: string
}

export interface ThreadComp {
  id: string
  lens: string
  span: string
  matter: string
  moments: Moment[]
  minHorizon: number
}

export type ThreadKind = 'thread' | 'rope'

export interface Strand {
  id: string
  label: string
  kind: ThreadKind
  declared: boolean
  comps: ThreadComp[]
  weight: number
  breadth: number
  span: { from: string; to: string }
  temperature: number
}

export interface ConnectionCandidate {
  threadA: string
  threadB: string
  oneLineReason: string
  similarity: number
}

export type EncounterKind =
  | 'answered'
  | 'redirected'
  | 'he_met_me'
  | 'surrendered'
  | 'he_changed_me'

export interface EncounterDeclaration {
  strandId: string
  kind: EncounterKind
  prose: string
}

export interface ThreadsData {
  strands: Strand[]
  restingCount: number
  candidates: ConnectionCandidate[]
}
