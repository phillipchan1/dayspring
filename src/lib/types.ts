// Domain types mirroring the Supabase schema (§5 of the spec).

export type EntrySource = 'native' | 'day_one' | 'other'

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
