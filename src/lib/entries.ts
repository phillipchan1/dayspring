import { requireSupabase } from './supabase'
import type { Entry, EntrySource, NewEntry } from './types'

export function wordCount(markdown: string): number {
  const trimmed = markdown.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Insert a new native entry and return the persisted row. */
export async function createEntry(input: NewEntry): Promise<Entry> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .insert({
      body_markdown: input.body_markdown,
      title: input.title ?? null,
      tags: input.tags ?? [],
      word_count: wordCount(input.body_markdown),
      source: 'native',
    })
    .select()
    .single()

  if (error) throw error
  return data as Entry
}

/**
 * Push a full entry row to the server (insert or update). Used by the sync
 * layer to replay local writes. `owner` is intentionally omitted so the DB
 * default (auth.uid()) fills it on insert and RLS keeps it private.
 */
export async function upsertEntryRow(entry: Entry): Promise<Entry> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .upsert({
      id: entry.id,
      created_at: entry.created_at,
      body_markdown: entry.body_markdown,
      title: entry.title,
      mood: entry.mood,
      tags: entry.tags,
      word_count: entry.word_count,
      source: entry.source,
      external_id: entry.external_id,
    })
    .select()
    .single()

  if (error) throw error
  return data as Entry
}

/** A row ready to import from an external source (e.g. a Diarly export). */
export interface ImportedEntry {
  created_at: string
  body_markdown: string
  title: string | null
  tags: string[]
  word_count: number
  external_id: string
}

const IMPORT_BATCH_SIZE = 500

/**
 * Upsert imported rows in batches, deduping on (source, external_id) so
 * re-importing the same export never creates duplicates. `owner` is omitted so
 * the DB default (auth.uid()) fills it and RLS keeps the rows private.
 * `onProgress(done, total)` fires after each batch.
 */
export async function upsertImportedEntries(
  rows: ImportedEntry[],
  source: EntrySource,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const sb = requireSupabase()
  for (let i = 0; i < rows.length; i += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(i, i + IMPORT_BATCH_SIZE).map((r) => ({
      created_at: r.created_at,
      body_markdown: r.body_markdown,
      title: r.title,
      mood: null,
      tags: r.tags,
      word_count: r.word_count,
      source,
      external_id: r.external_id,
    }))
    const { error } = await sb.from('entries').upsert(batch, { onConflict: 'source,external_id' })
    if (error) throw error
    onProgress?.(Math.min(i + batch.length, rows.length), rows.length)
  }
}

/** Update an entry's body (recomputes word_count). Returns the persisted row. */
export async function updateEntryBody(id: string, body_markdown: string): Promise<Entry> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .update({ body_markdown, word_count: wordCount(body_markdown) })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Entry
}

/** Delete an entry. */
export async function deleteEntry(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('entries').delete().eq('id', id)
  if (error) throw error
}

/** List entries newest-first. */
export async function listEntries(limit = 50): Promise<Entry[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as Entry[]
}
