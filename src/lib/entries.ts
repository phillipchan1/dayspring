import { requireSupabase } from './supabase'
import type { Entry, NewEntry } from './types'

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
