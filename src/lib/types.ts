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
  entry_id?: string | null
  type: SpiritualItemType
  content: string
  metadata?: Record<string, unknown> | null
}

export interface ScripturePassage {
  reference: string
  text: string
  reason: string
}
