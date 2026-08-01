// Domain types mirroring the Supabase schema.

export type EntrySource = 'native' | 'day_one' | 'diarly' | 'other'

export interface Entry {
  id: string
  created_at: string // original entry date (ISO); for native entries = creation time
  /**
   * The SERVER's clock, and nothing else. Local edits deliberately leave it
   * alone so it keeps meaning "the version the server last gave us" — which is
   * both the only timestamp comparable across devices and the base an
   * optimistic-concurrency push checks against. See lib/entryVersion.ts.
   */
  updated_at: string
  body_markdown: string
  title: string | null
  mood: string | null
  tags: string[]
  word_count: number
  source: EntrySource
  external_id: string | null
  /**
   * Local-only (never sent, never returned): when THIS device last edited the
   * row, epoch ms. Orders local edits against each other — which `updated_at`
   * can no longer do — so a push can tell whether the row changed underneath it
   * while it was in flight.
   */
  local_edited_at?: number
}

/** Fields the client sets when creating a native entry. */
export interface NewEntry {
  body_markdown: string
  title?: string | null
  tags?: string[]
}

// ── Spiritual items ────────────────────────────────────────────────────────

export type SpiritualItemType = 'prayer' | 'sense' | 'scripture'

export type PrayerType = 'intercession' | 'gratitude' | 'petition' | 'praise'

export interface SpiritualItem {
  id: string
  owner: string
  entry_id: string | null
  type: SpiritualItemType
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
  /** @deprecated legacy answered-binary — superseded by `encounters`. Read-only. */
  resolved_at: string | null
  /** The prayer_thread this prayer/sense belongs to (set server-side). */
  thread_id: string | null
}

// ── Altar — remembrance ───────────────────────────────────────────────────────
// Light = ENCOUNTER, not transaction. A thread "lights" only when an `encounters`
// row exists. There is no answered/unanswered; "still carrying" = no encounter.

/** How God moved when He met the writer (the lit vocabulary). Never AI-assigned. */
export type Movement = 'answered' | 'redirected' | 'he_met_me' | 'surrendered' | 'he_changed_me'

/** Display labels for the movement words (DB stores the snake_case enum). */
export const MOVEMENT_LABEL: Record<Movement, string> = {
  answered: 'answered',
  redirected: 'redirected',
  he_met_me: 'He met me',
  surrendered: 'surrendered',
  he_changed_me: 'He changed me',
}

/** Order shown in the naming UI. */
export const MOVEMENTS: Movement[] = [
  'answered',
  'redirected',
  'he_met_me',
  'surrendered',
  'he_changed_me',
]

/** A recurring prayer line + every return. Drives the cairn. */
export interface PrayerThread {
  id: string
  owner: string
  title: string
  carries: string[]
  planted_at: string
  last_touch_at: string
  seed_item_id: string | null
  created_at: string
}

/** The user's testimony of how God moved. One per thread, editable. */
export interface Encounter {
  id: string
  owner: string
  thread_id: string
  movement: Movement
  named_at: string
  source_entry_id: string | null
  reflection_text: string | null
  created_at: string
}

/** AI-surfaced evidence beside an open thread — a quote + a gentle question, never a verdict. */
export interface AltarCandidate {
  id: string
  thread_id: string
  source_entry_id: string | null
  entry_date: string
  quote: string
  char_start: number | null
  char_end: number | null
  one_line_reason: string
  gentle_question: string
}

export interface NewSpiritualItem {
  /** When set, the fence block and DB row share this id (instant insert). */
  id?: string
  entry_id?: string | null
  type: SpiritualItemType
  content: string
  metadata?: Record<string, unknown> | null
}

export interface ScripturePassage {
  reference: string
  text: string
  reason: string
  /** The translation used (e.g. "ESV", "NIV"). Set client-side from the user's preference. */
  translation?: string
}

// ── Scripture refs ──────────────────────────────────────────────────────────
// One row per scripture reference captured from an entry. Mirrors the
// scripture_refs table; ownership keys on `owner` like every other table.

export type ScriptureRefSource = 'parsed' | 'inline' | 'command' | 'manual'
export type ScriptureRefStatus = 'confirmed' | 'suggested'

export interface ScriptureRef {
  id: string
  owner: string
  entry_id: string
  book_osis: string
  book_name: string
  book_order: number
  chapter: number
  verse_start: number | null
  verse_end: number | null
  osis_ref: string
  /** Denormalized from entries.created_at — the source date, not the import date. */
  entry_created_at: string
  source: ScriptureRefSource
  confidence: number
  status: ScriptureRefStatus
  char_start: number | null
  char_end: number | null
  created_at: string
}
