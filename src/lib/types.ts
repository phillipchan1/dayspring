// Domain types mirroring the Supabase schema.

export type EntrySource = 'native' | 'day_one' | 'diarly' | 'other'

export interface Entry {
  id: string
  created_at: string // original entry date (ISO); for native entries = creation time
  updated_at: string
  body_markdown: string
  title: string | null
  mood: string | null
  tags: string[]
  word_count: number
  source: EntrySource
  external_id: string | null
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
  resolved_at: string | null
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
