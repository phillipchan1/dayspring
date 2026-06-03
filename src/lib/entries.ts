import { stripSpiritualBlocks } from './spiritualBlocks'
import { requireSupabase } from './supabase'
import type { Entry, EntrySource, NewEntry } from './types'

// Explicit column list = every Entry field EXCEPT the server-only `embedding`
// vector. Selecting `*` would drag 1536 floats per row to the client; at list
// sizes (~1000 rows) that blows past the authenticated role's statement timeout
// (→ 500). Embeddings are never read client-side.
const ENTRY_COLUMNS =
  'id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id'

export function wordCount(markdown: string): number {
  const trimmed = stripSpiritualBlocks(markdown).trim()
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
    .select(ENTRY_COLUMNS)
    .single()

  if (error) throw error
  return data as Entry
}

/**
 * Push a full entry row to the server (insert or update). Used by the sync
 * layer to replay local writes. `owner` is intentionally omitted so the DB
 * default (auth.uid()) fills it on insert and RLS keeps it private.
 *
 * Note: `entries` is a view backed by encrypted storage. Views don't support
 * ON CONFLICT, so we try INSERT first and fall back to UPDATE on duplicate id.
 */
export async function upsertEntryRow(entry: Entry): Promise<Entry> {
  const sb = requireSupabase()
  const row = {
    id: entry.id,
    created_at: entry.created_at,
    body_markdown: entry.body_markdown,
    title: entry.title,
    mood: entry.mood,
    tags: entry.tags,
    word_count: entry.word_count,
    source: entry.source,
    external_id: entry.external_id,
  }

  const { data: inserted, error: insertErr } = await sb
    .from('entries')
    .insert(row)
    .select(ENTRY_COLUMNS)
    .single()

  if (!insertErr) return inserted as Entry
  // 23505 = unique_violation (id already exists — this is a sync replay)
  if ((insertErr as { code?: string }).code !== '23505') throw insertErr

  const { data, error } = await sb
    .from('entries')
    .update({
      body_markdown: entry.body_markdown,
      title: entry.title,
      mood: entry.mood,
      tags: entry.tags,
      word_count: entry.word_count,
      source: entry.source,
      external_id: entry.external_id,
    })
    .eq('id', entry.id)
    .select(ENTRY_COLUMNS)
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
 *
 * Note: `entries` is a view backed by encrypted storage. Views don't support
 * ON CONFLICT, so we SELECT existing rows first then INSERT or UPDATE accordingly.
 */
export async function upsertImportedEntries(
  rows: ImportedEntry[],
  source: EntrySource,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const sb = requireSupabase()
  for (let i = 0; i < rows.length; i += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(i, i + IMPORT_BATCH_SIZE)
    const extIds = batch.map((r) => r.external_id).filter(Boolean)

    // Find which (source, external_id) pairs already exist.
    const { data: existing, error: selectErr } = extIds.length > 0
      ? await sb
          .from('entries')
          .select('id, external_id')
          .eq('source', source)
          .in('external_id', extIds)
      : { data: [] as { id: string; external_id: string }[], error: null }
    if (selectErr) throw selectErr

    const existingMap = new Map((existing ?? []).map((e) => [e.external_id, e.id]))

    const toInsert = batch.filter((r) => !existingMap.has(r.external_id))
    const toUpdate = batch
      .filter((r) => existingMap.has(r.external_id))
      .map((r) => ({ ...r, _id: existingMap.get(r.external_id)! }))

    if (toInsert.length > 0) {
      const { error } = await sb.from('entries').insert(
        toInsert.map((r) => ({
          created_at: r.created_at,
          body_markdown: r.body_markdown,
          title: r.title,
          mood: null,
          tags: r.tags,
          word_count: r.word_count,
          source,
          external_id: r.external_id,
        })),
      )
      if (error) throw error
    }

    // Update existing entries (bounded concurrency to avoid hammering the DB).
    const UPDATE_POOL = 10
    for (let j = 0; j < toUpdate.length; j += UPDATE_POOL) {
      await Promise.all(
        toUpdate.slice(j, j + UPDATE_POOL).map(({ _id, created_at, body_markdown, title, tags, word_count }) =>
          sb
            .from('entries')
            .update({ created_at, body_markdown, title, tags, word_count })
            .eq('id', _id),
        ),
      )
    }

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
    .select(ENTRY_COLUMNS)
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

/** Fetch one entry by id — for history beyond the locally-cached recent window. */
export async function getEntryById(id: string): Promise<Entry | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('entries').select(ENTRY_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Entry | null) ?? null
}

/** Fetch specific entries by id (chunked to stay under PostgREST URL limits). */
export async function fetchEntriesByIds(ids: string[]): Promise<Entry[]> {
  if (ids.length === 0) return []
  const sb = requireSupabase()
  const out: Entry[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { data, error } = await sb.from('entries').select(ENTRY_COLUMNS).in('id', chunk)
    if (error) throw error
    for (const e of (data ?? []) as Entry[]) out.push(e)
  }
  return out
}

/** List entries newest-first. */
export async function listEntries(limit = 50): Promise<Entry[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .select(ENTRY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as Entry[]
}

/**
 * Entries whose `created_at` falls in [fromISO, toExclusiveISO), oldest-first —
 * the lived order the Valley reads. Mirrors the server's windowed read
 * (`api/_lib/synthesize.ts fetchEntries`) so the week shows exactly what fed the
 * weekly rollup.
 */
export async function listEntriesInWindow(fromISO: string, toExclusiveISO: string): Promise<Entry[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .select(ENTRY_COLUMNS)
    .gte('created_at', fromISO)
    .lt('created_at', toExclusiveISO)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Entry[]
}

const ENTRY_PAGE = 1000

/**
 * Every entry, newest-first — paginated past PostgREST's ~1000-row cap so the
 * whole journal can be cached locally (not just a recent window). One-time cost
 * on first sync; cheap thereafter.
 */
export async function listAllEntries(): Promise<Entry[]> {
  const sb = requireSupabase()
  const out: Entry[] = []
  for (let from = 0; ; from += ENTRY_PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select(ENTRY_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + ENTRY_PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as Entry[]
    out.push(...rows)
    if (rows.length < ENTRY_PAGE) break
  }
  return out
}
