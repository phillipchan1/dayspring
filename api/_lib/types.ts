// Server-side copy of the rollup payload contract (§3). The client keeps its own
// copy in src/lib/insights.ts — they must stay in sync, but the server never
// imports from src/ (which would pull in VITE_ client env) and vice versa.

export type RollupType = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

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

// ── Rich "Looking Back" content (the v2 reflection surface) ─────────────────
// Prose fields are GENERATED (the model writes them, grounded by the lower-level
// rollups + strict prompt rules). Excerpt-bearing fields (citations, ebenezer)
// are VERBATIM and validated in code — anything that doesn't exact-match a real
// source is dropped, same no-fabrication gate as quotes.

export interface Excerpt {
  entry_id: string
  date: string
  text: string
}

/** An earlier ask set beside a later moment. The job only PAIRS (both texts
 *  validated verbatim); it never marks a verdict — the user does that. */
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

/** HILLSIDE (monthly): a recurrence the app names TENTATIVELY. `weight` = the
 *  count of validated supporting entries; `name`/`note` are prose (the one
 *  interpretive move, hedged + user-editable). Never a verdict. */
export interface Arc {
  id: string
  name: string
  note: string
  weight: number
  entry_ids: string[]
}

/** RIDGE (quarterly): an open thread the writer keeps circling, handed back as a
 *  QUESTION. `thread` is a short label; `question` invites — it never resolves. */
export interface Tension {
  id: string
  thread: string
  question: string
}

/** SUMMIT (yearly): the year's refrain — ONE line copied VERBATIM from a real
 *  entry, with offsets so the UI can prove it. Hard guardrail: never paraphrased
 *  or generated; dropped entirely if it doesn't exact-match a source. */
export interface Refrain {
  entry_id: string
  date: string
  text: string
  char_start: number
  char_end: number
}

/** AI-prefilled win candidate; the user edits/confirms it in the UI. */
export interface WinCandidate {
  id: string
  text: string
}

/**
 * The rich, horizon-shaped content the Looking Back UI renders. Every field is
 * optional — each horizon fills only the slots that belong to it. Stored under
 * `RollupPayload.reflection`; absent on legacy rows (UI falls back gracefully).
 */
export interface ReflectionContent {
  /** weekly + quarterly: the synthesized arc, in paragraphs. */
  synthesis?: string[]
  /** monthly: a second-person letter (paragraphs). */
  letter?: string[]
  /** monthly: how you gained vs. the prior period (paragraphs). */
  gain?: string[]
  /** monthly: a chronic measure-against-the-ideal reflex to watch. */
  gapWatch?: string
  /** monthly + yearly: the 1–2 recurring threads, in prose. */
  themes?: string[]
  /** monthly (Hillside): 3–5 named recurrences with weight — the app names tentatively. */
  arcs?: Arc[]
  /** quarterly (Ridge): open tensions handed back as questions — the app asks, never answers. */
  tensions?: Tension[]
  /** yearly (Summit): the verbatim refrain lifted from a real entry. */
  refrain?: Refrain
  /** yearly: who you were vs. who you are now (paragraphs). */
  throughline?: string[]
  /** weekly: verbatim lines worth rereading. */
  citations?: Excerpt[]
  /** monthly: verbatim evidence behind the gain claim. */
  gainEvidence?: Excerpt[]
  /** quarterly: earlier asks paired with later moments (user marks verdict). */
  ebenezer?: EbenezerPair[]
  /** yearly: the strongest answered-prayer pairings across the year. */
  stones?: EbenezerPair[]
  /** weekly + quarterly: invitational prompts (the AI asks, never answers). */
  questions?: ReflectionQuestion[]
  /** weekly: AI-prefilled win candidates the user can keep or rewrite. */
  wins?: { thisWeek: WinCandidate[]; nextWeek: WinCandidate[] }
}

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

// ── Raw model outputs (before server-side validation), per horizon ──────────

export interface RawExcerpt {
  entry_id: string
  date: string
  text: string
}
export interface RawPair {
  ask: RawExcerpt
  later: RawExcerpt
}
export interface RawQuestion {
  text: string
  addressee: string
}
export interface RawArc {
  name: string
  note: string
  entry_ids: string[]
}
export interface RawTension {
  thread: string
  question: string
}
export interface RawRefrain {
  entry_id: string
  date: string
  text: string
}

/** Weekly: the grounding picks (quotes/topics/observation) + rich generated content. */
export interface WeeklyModelOutput {
  quotes: Quote[]
  topics: Topic[]
  observation: Observation
  synthesis: string[]
  wins: { this_week: string[]; next_week: string[] }
  questions: RawQuestion[]
}

export interface MonthlyModelOutput {
  quotes: Quote[]
  topics: Topic[]
  observation: Observation
  letter: string[]
  gain: string[]
  gap_watch: string
  themes: string[]
  arcs: RawArc[]
}

export interface QuarterlyModelOutput {
  synthesis: string[]
  questions: RawQuestion[]
  ebenezer: RawPair[]
  tensions: RawTension[]
}

export interface YearlyModelOutput {
  throughline: string[]
  themes: string[]
  stones: RawPair[]
  refrain: RawRefrain | null
}
