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

/**
 * Newest-first comparator for ISO-8601 `created_at`. Plain string comparison is
 * orders of magnitude cheaper than `localeCompare` and gives identical ordering
 * for ISO timestamps (lexicographic == chronological). Used for the entry list,
 * which sorts thousands of rows on every sync / realtime update.
 */
export function byCreatedDesc(a: { created_at: string }, b: { created_at: string }): number {
  return a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0
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
 * Upsert imported rows in batches, deduping on (owner, source, external_id) so
 * re-importing the same export never creates duplicates — and two different
 * users' imports can't collide on a shared external_id. `owner` is set explicitly
 * (matching the composite conflict target); RLS still requires it equal auth.uid().
 * `onProgress(done, total)` fires after each batch.
 *
 * `ignoreDuplicates` (default true): existing entries are left untouched so any
 * manual edits made after the first import are preserved. Pass false only when
 * you intentionally need to overwrite body content — e.g. the image-import phase
 * writing back resolved attachment refs.
 */
export async function upsertImportedEntries(
  rows: ImportedEntry[],
  source: EntrySource,
  onProgress?: (done: number, total: number) => void,
  { ignoreDuplicates = true }: { ignoreDuplicates?: boolean } = {},
): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) throw new Error('not signed in')
  for (let i = 0; i < rows.length; i += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(i, i + IMPORT_BATCH_SIZE).map((r) => ({
      owner: user.id,
      created_at: r.created_at,
      body_markdown: r.body_markdown,
      title: r.title,
      mood: null,
      tags: r.tags,
      word_count: r.word_count,
      source,
      external_id: r.external_id,
    }))
    const { error } = await sb
      .from('entries')
      .upsert(batch, { onConflict: 'owner,source,external_id', ignoreDuplicates })
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

/**
 * Entries whose `updated_at` is strictly after `cursorISO`, for incremental
 * sync — only what changed since the last pull, instead of the whole library.
 * Ordered by `updated_at` so paging is stable. Note: server-side deletes are
 * invisible to this query (a deleted row simply isn't returned); callers rely on
 * realtime + a periodic full reconcile to drop deleted rows.
 */
export async function listEntriesSince(cursorISO: string): Promise<Entry[]> {
  const sb = requireSupabase()
  const out: Entry[] = []
  for (let from = 0; ; from += ENTRY_PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select(ENTRY_COLUMNS)
      .gt('updated_at', cursorISO)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: false })
      .range(from, from + ENTRY_PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as Entry[]
    out.push(...rows)
    if (rows.length < ENTRY_PAGE) break
  }
  return out
}
