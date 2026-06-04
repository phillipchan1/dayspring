/** 0=week · 1=month · 2=season · 3=year · 4=all time */
export type Horizon = 0 | 1 | 2 | 3 | 4

export interface Moment {
  date: string
  prose: string
  /** TODO: wire real data — link back to the source journal entry */
  entryId: string
}

export interface ThreadComp {
  id: string
  /** e.g. "Trading discipline", "Prayer", "Family" */
  lens: string
  /** e.g. "Feb→" */
  span: string
  /** Verbatim user prose from the source rollup — never rewritten */
  matter: string
  moments: Moment[]
  /** The horizon at which this component thread joins the rope. */
  minHorizon: Horizon
}

export type ThreadKind = 'thread' | 'rope'

export interface Strand {
  id: string
  label: string
  kind: ThreadKind
  /** True when the user has named/declared this rope. */
  declared: boolean
  /** All components across ALL time; the UI filters by the active horizon. */
  comps: ThreadComp[]
  /** Count of source moments across visible comps (computed per horizon). */
  weight: number
  /** Count of distinct lenses across visible comps (computed per horizon). */
  breadth: number
  span: { from: string; to: string }
  /** 0–1 recency score: 1 = active this week, 0 = dormant. */
  temperature: number
}

/**
 * A candidate connection between two strands — shown as a question beside the
 * strand, never a verdict. The app never names the lesson.
 *
 * TODO: wire real data — derived from pgvector embedding similarity
 */
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

/**
 * User-declared encounter on a named rope.
 * TODO: wire real data — persisted to encounters table (same as Altar)
 */
export interface EncounterDeclaration {
  strandId: string
  kind: EncounterKind
  prose: string
}

export interface ThreadsData {
  strands: Strand[]
  /** How many strands are resting below the field-max cut for this horizon. */
  restingCount: number
  /** Connection candidates for this horizon — shown inline, one-tap dismissible. */
  candidates: ConnectionCandidate[]
}
