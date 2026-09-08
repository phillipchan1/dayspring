import { apiUrl } from './api'
import { parseSpiritualBlocks } from './spiritualBlocks'
import { requireSupabase } from './supabase'
import type { NewSpiritualItem, SpiritualItem, SpiritualItemType } from './types'

// Every SpiritualItem field EXCEPT the server-only `embedding` vector — never
// ship 1536 floats to the client (see ENTRY_COLUMNS in entries.ts).
const ITEM_COLUMNS = 'id, owner, entry_id, type, content, metadata, created_at, resolved_at, thread_id'

export async function createSpiritualItem(item: NewSpiritualItem): Promise<SpiritualItem> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const { data, error } = await sb
    .from('spiritual_items')
    .insert({
      ...(item.id ? { id: item.id } : {}),
      owner: session.user.id,
      entry_id: item.entry_id ?? null,
      type: item.type,
      content: item.content,
      metadata: item.metadata ?? null,
    })
    .select(ITEM_COLUMNS)
    .single()

  if (error) throw error
  return data as SpiritualItem
}

export async function listSpiritualItems(type?: SpiritualItemType): Promise<SpiritualItem[]> {
  const sb = requireSupabase()
  let q = sb
    .from('spiritual_items')
    .select(ITEM_COLUMNS)
    .order('created_at', { ascending: false })

  if (type) q = q.eq('type', type)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SpiritualItem[]
}

export async function getSpiritualItem(id: string): Promise<SpiritualItem | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('spiritual_items').select(ITEM_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as SpiritualItem | null) ?? null
}

/**
 * @deprecated The binary answered/unanswered model is retired — light = ENCOUNTER
 * now (see src/lib/altar/encounters.ts). Existing resolved_at rows are migrated to
 * `answered` encounters by scripts/altar-backfill.ts. Kept only so historical data
 * isn't lost; do not call from new code.
 */
export async function markPrayerAnswered(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('spiritual_items')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Update content and/or metadata when a block is edited in place. */
export async function updateSpiritualItem(
  id: string,
  fields: { content?: string; metadata?: Record<string, unknown> | null },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (fields.content !== undefined) patch.content = fields.content
  if (fields.metadata !== undefined) patch.metadata = fields.metadata
  if (Object.keys(patch).length === 0) return
  const sb = requireSupabase()
  const { error } = await sb.from('spiritual_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSpiritualItem(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('spiritual_items').delete().eq('id', id)
  if (error) throw error
}

/**
 * Reconcile spiritual_items with the fenced blocks in an entry's body: the block
 * is the source of truth, so write a row for every block present and delete rows
 * for blocks the user removed, keeping the Altar free of orphaned prayers.
 *
 * Upsert, not update. The row is normally created by the popover that inserts the
 * block, over the network — so a prayer written offline has no row at all, and
 * reconciling with an UPDATE would leave the Altar permanently missing it even
 * after the entry itself synced. Recreating from the block closes that.
 *
 * `metadata` is deliberately absent from the payload: PostgREST only assigns the
 * columns it is given, so a conflict leaves whatever the popover stored intact,
 * while an insert gets the column default. `created_at` is likewise omitted —
 * the Altar dates a linked item by its entry (lib/altar/query.ts), so a row
 * recreated on reconnect still reads as the day it was written.
 *
 * ── What the reconcile OWNS ──────────────────────────────────────────────────
 *
 * Only rows that came from a fence. The delete used to be scoped by entry alone,
 * which read as "the block is the source of truth" and meant something much
 * larger: a harvested row has no fence, so every `source='scanned'` prayer on the
 * page was deleted the next time the writer touched the entry. Measured before
 * the fix, that was 6,463 of 6,514 markings — 99.2% of the archive, across 2,097
 * entries — one edit away from being erased, with the Altar quietly losing the
 * thread each one belonged to.
 *
 * The harvest has its own lifecycle (`prayer_scanned_at`, `resetHarvest`) and is
 * not this function's to prune. NULL counts as editor-written: rows predate the
 * `source` column's default.
 */
export async function syncSpiritualBlocksFromMarkdown(
  entryId: string | null,
  markdown: string,
): Promise<void> {
  if (!entryId) return
  const blocks = parseSpiritualBlocks(markdown)
  const ids = blocks.map((b) => b.id)
  const sb = requireSupabase()

  if (blocks.length > 0) {
    const {
      data: { session },
    } = await sb.auth.getSession()
    if (!session) throw new Error('not authenticated')
    const { error } = await sb.from('spiritual_items').upsert(
      blocks.map((b) => ({
        id: b.id,
        owner: session.user.id,
        entry_id: entryId,
        type: b.type,
        content: b.content,
        // Offsets into body_markdown as stored, fences included — so a declared
        // block finally has a position. Rewritten on every save, because every
        // edit above it moves it.
        char_start: b.from,
        char_end: b.to,
      })),
      { onConflict: 'id' },
    )
    if (error) throw error
  }

  let del = sb
    .from('spiritual_items')
    .delete()
    .eq('entry_id', entryId)
    .or('source.is.null,source.eq.command')
  if (ids.length > 0) del = del.not('id', 'in', `(${ids.join(',')})`)
  const { error } = await del
  if (error) throw error
}

/** One marking, reduced to what a surface needs to light a page by it. */
export interface MarkingRef {
  entryId: string
  type: SpiritualItemType
  /**
   * Did the writer name it, or did the journal notice it?
   *
   * `source='command'` is a `/pray` the writer typed. Everything else was
   * harvested from the prose of an already-written page — the writer's own
   * verbatim sentence, selected by a model. Both are real markings and both
   * light the same pill; the difference is recorded because it is true, not
   * because the surface asks the reader to care.
   */
  declared: boolean
}

/**
 * Every marking, as page references only.
 *
 * Deliberately not `listSpiritualItems`: this is the whole archive — thousands
 * of rows — and a surface that only needs to know WHICH pages carry a prayer
 * has no business pulling every prayer's text across the wire to find out.
 */
export async function listMarkings(): Promise<MarkingRef[]> {
  const sb = requireSupabase()
  const out: MarkingRef[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('spiritual_items')
      .select('entry_id, type, source')
      .not('entry_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as { entry_id: string; type: SpiritualItemType; source: string | null }[]
    for (const r of rows) {
      out.push({ entryId: r.entry_id, type: r.type, declared: r.source === 'command' })
    }
    if (rows.length < PAGE) return out
  }
}

/** One marking on one page, with the sentence it was made of. */
export interface PageMarking {
  id: string
  entryId: string
  type: SpiritualItemType
  /** The writer's own words, verbatim — never a summary. */
  content: string
  declared: boolean
}

/**
 * The markings on ONE page, with their text.
 *
 * `listMarkings` deliberately fetches no content: it lights the whole wall, and
 * a surface that only needs to know WHICH pages carry a prayer has no business
 * pulling every prayer's text across the wire.
 *
 * That economy had a cost nobody had noticed. It made a marking a page-level
 * boolean with no words and no place on the page — so lighting "Tiffany" and
 * "Scripture" together could only ever mean "both are true somewhere on this
 * page", and opening one showed nothing connecting them, because no connection
 * had ever been computed. A subject is located in the prose; a marking was not.
 *
 * This is the other half. One page's worth is a handful of short rows, fetched
 * when that page is opened — which is cheap in exactly the way the whole
 * corpus is not, and it is what lets an open page show the scripture where it
 * actually sits rather than asserting that one is in here somewhere.
 */
export async function markingsForEntry(entryId: string): Promise<PageMarking[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('spiritual_items')
    .select('id, type, content, source')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return toPageMarkings(data, entryId)
}

interface MarkingRow {
  id: string
  entry_id?: string | null
  type: SpiritualItemType
  content: string | null
  source: string | null
}

function toPageMarkings(data: unknown, fallbackEntryId?: string): PageMarking[] {
  const rows = (data ?? []) as MarkingRow[]
  const out: PageMarking[] = []
  for (const r of rows) {
    const content = (r.content ?? '').trim()
    const entryId = r.entry_id ?? fallbackEntryId
    // A marking with no words cannot be shown where it sits, and one with no
    // page has nowhere to sit — neither is an error, just nothing to draw.
    if (!content || !entryId) continue
    out.push({ id: r.id, entryId, type: r.type, content, declared: r.source === 'command' })
  }
  return out
}

/**
 * The markings on MANY pages, with their text.
 *
 * For the one reading that needs the join rather than the page: what you marked
 * beside the pages that carry a subject. The set is already narrowed by that
 * subject before this is called, so the cost is bounded by the question the
 * reader actually asked rather than by the size of the archive — which is what
 * keeps `listMarkings` right to stay text-free for everything else.
 *
 * Chunked to stay under PostgREST's URL limit, the same as `fetchEntriesByIds`.
 */
export async function markingsForEntries(entryIds: string[]): Promise<PageMarking[]> {
  if (entryIds.length === 0) return []
  const sb = requireSupabase()
  const out: PageMarking[] = []
  for (let i = 0; i < entryIds.length; i += 200) {
    const { data, error } = await sb
      .from('spiritual_items')
      .select('id, entry_id, type, content, source')
      .in('entry_id', entryIds.slice(i, i + 200))
    if (error) throw error
    out.push(...toPageMarkings(data))
  }
  return out
}

export async function unmarkPrayerAnswered(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('spiritual_items')
    .update({ resolved_at: null })
    .eq('id', id)
  if (error) throw error
}

// Scripture is ESV-only and resolves in two progressive phases so references
// render the instant the model returns, with verbatim ESV text filling in behind
// them. The text is authoritative — never model-generated.

/** A reference + reason the model picked, before its verse text is resolved. */
export interface CandidateRef {
  reference: string
  reason: string
}

/** A resolved passage: the ESV's canonical reference + verbatim text. */
export interface ResolvedRef {
  reference: string
  text: string
}

async function authHeader(): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')
  return `Bearer ${session.access_token}`
}

/** Phase 1 — the model picks candidate references (no verse text yet). Fast. */
export async function fetchScriptureRefs(content: string): Promise<CandidateRef[]> {
  const res = await fetch(apiUrl('/api/spiritual/scripture'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'failed' }))) as { error?: string }
    throw new Error(err.error ?? 'Scripture search failed')
  }
  const result = (await res.json()) as { passages: CandidateRef[] }
  return result.passages
}

/**
 * Phase 2 — resolve verbatim ESV text for the picked references (cache-first on
 * the server). Returns one slot per input reference, in order: a resolved
 * passage, or null when the reference didn't resolve to real ESV text.
 */
export async function resolveScripturePassages(references: string[]): Promise<(ResolvedRef | null)[]> {
  const res = await fetch(apiUrl('/api/spiritual/scripture-resolve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ references }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'failed' }))) as { error?: string }
    throw new Error(err.error ?? 'Could not load verse text')
  }
  const result = (await res.json()) as { resolved: (ResolvedRef | null)[] }
  return result.resolved
}

export interface ChapterVerse {
  n: number
  text: string
}

export interface ScriptureChapter {
  book: string
  chapter: number
  verses: ChapterVerse[]
}

/** One chapter of numbered ESV text for the in-journal reader. */
export async function fetchScriptureChapter(book: string, chapter: number): Promise<ScriptureChapter> {
  const res = await fetch(apiUrl('/api/spiritual/scripture-chapter'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ book, chapter }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'failed' }))) as { error?: string }
    throw new Error(err.error ?? 'Could not load the chapter')
  }
  return (await res.json()) as ScriptureChapter
}
