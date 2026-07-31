// All Supabase access for the Scripture surface lives here. Everything else
// (the parser, the canon, the formatters, the view) stays free of supabase
// imports.
//
// Source of truth is the scripture_refs table (populated by the backfill and,
// later, live capture). When the network/table is unavailable we fall back to
// deriving refs from the locally-cached entries with the same isomorphic parser
// — so the map still lights up offline. RLS scopes every read to the owner.

import { getCache, invalidateCachePrefix, setCache, windowCacheKey } from '../asyncCache'
import { bookByOsis } from '../bible/canon'
import * as cache from '../db'
import { fetchEntriesByIds } from '../entries'
import { requireSupabase } from '../supabase'
import { isListingPreview } from '../previewMode'
import { parseReferences } from './parse'

export interface DateWindow {
  from?: Date
  to?: Date
}

/** The minimal ref shape the aggregations need (real rows or derived ones). */
interface RefLike {
  entry_id: string
  book_osis: string
  book_order: number
  chapter: number
  osis_ref: string
  entry_created_at: string
  char_start: number | null
}

export interface CanonHeat {
  /** `${osis}:${chapter}` → distinct entry count. */
  chapters: Map<string, number>
  /** osis → distinct entry count across the whole book. */
  books: Map<string, number>
  /** Largest single-chapter distinct-entry count, for normalizing the ramp. */
  max: number
}

export interface ReturningRef {
  osis_ref: string
  book_osis: string
  count: number
}

export interface BookEntry {
  entry_id: string
  entry_created_at: string
  /** Refs from this book that this entry touched (display order). */
  refs: string[]
  /** Short excerpt around the first ref's char_start, from the cached entry. */
  excerpt: string
}

export type RefStatus = 'confirmed' | 'suggested'

/** One moment a single verse surfaced — the substrate of the Scripture drill-in.
 *  Carries the row id + status so the funnel can promote a suggested allusion. */
export interface VerseMoment {
  ref_id: string
  entry_id: string
  entry_created_at: string
  status: RefStatus
  /** Short excerpt around char_start, from the cached/fetched entry body. */
  excerpt: string
}

// ── loading ───────────────────────────────────────────────────────────────

function inWindow(iso: string, w?: DateWindow): boolean {
  if (!w) return true
  const t = Date.parse(iso)
  if (w.from && t < w.from.getTime()) return false
  if (w.to && t > w.to.getTime()) return false
  return true
}

const REF_PAGE = 1000

const refsInflight = new Map<string, Promise<RefLike[]>>()

/** Drop cached canon/book reads (after scan completes, etc.). */
export function invalidateScriptureCache(): void {
  invalidateCachePrefix('scripture:')
  refsInflight.clear()
}

/**
 * Confirmed refs for the owner across the WHOLE journal (paginated past
 * PostgREST's default ~1000-row cap, so the map never silently truncates).
 * Falls back to local parse when offline.
 */
async function loadRefs(window?: DateWindow): Promise<RefLike[]> {
  const key = windowCacheKey(window)
  const inflight = refsInflight.get(key)
  if (inflight) return inflight
  const p = loadRefsOnce(window).finally(() => refsInflight.delete(key))
  refsInflight.set(key, p)
  return p
}

async function loadRefsOnce(window?: DateWindow): Promise<RefLike[]> {
  try {
    const sb = requireSupabase()
    const out: RefLike[] = []
    for (let from = 0; ; from += REF_PAGE) {
      let q = sb
        .from('scripture_refs')
        .select('entry_id, book_osis, book_order, chapter, osis_ref, entry_created_at, char_start')
        .eq('status', 'confirmed')
        .order('entry_created_at', { ascending: true })
        .order('osis_ref', { ascending: true })
        .range(from, from + REF_PAGE - 1)
      if (window?.from) q = q.gte('entry_created_at', window.from.toISOString())
      if (window?.to) q = q.lte('entry_created_at', window.to.toISOString())
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as RefLike[]
      out.push(...rows)
      if (rows.length < REF_PAGE) break
    }
    return out
  } catch {
    // Offline / table missing — derive from cached entries so the map still reads.
    return deriveRefsFromCache(window)
  }
}

async function deriveRefsFromCache(window?: DateWindow): Promise<RefLike[]> {
  const entries = await cache.cacheGetAll()
  const out: RefLike[] = []
  for (const e of entries) {
    if (!inWindow(e.created_at, window)) continue
    for (const r of parseReferences(e.body_markdown)) {
      out.push({
        entry_id: e.id,
        book_osis: r.book_osis,
        book_order: r.book_order,
        chapter: r.chapter,
        osis_ref: r.osis_ref,
        entry_created_at: e.created_at,
        char_start: r.char_start,
      })
    }
  }
  return out
}

// ── aggregations ────────────────────────────────────────────────────────────

function canonHeatFromRefs(refs: RefLike[]): CanonHeat {
  const chapterSets = new Map<string, Set<string>>()
  const bookSets = new Map<string, Set<string>>()
  for (const r of refs) {
    const ck = `${r.book_osis}:${r.chapter}`
    ;(chapterSets.get(ck) ?? chapterSets.set(ck, new Set()).get(ck)!).add(r.entry_id)
    ;(bookSets.get(r.book_osis) ?? bookSets.set(r.book_osis, new Set()).get(r.book_osis)!).add(r.entry_id)
  }
  const chapters = new Map<string, number>()
  let max = 0
  for (const [k, set] of chapterSets) {
    chapters.set(k, set.size)
    if (set.size > max) max = set.size
  }
  const books = new Map<string, number>()
  for (const [k, set] of bookSets) books.set(k, set.size)
  return { chapters, books, max }
}

function seasonSummaryFromRefs(refs: RefLike[]): SeasonSummary {
  const bookSets = new Map<string, Set<string>>()
  const verseSets = new Map<string, Set<string>>()
  for (const r of refs) {
    ;(bookSets.get(r.book_osis) ?? bookSets.set(r.book_osis, new Set()).get(r.book_osis)!).add(r.entry_id)
    ;(verseSets.get(r.osis_ref) ?? verseSets.set(r.osis_ref, new Set()).get(r.osis_ref)!).add(r.entry_id)
  }
  const topBooks = [...bookSets.entries()]
    .map(([osis, set]) => ({ osis, name: bookByOsis(osis)?.name ?? osis, count: set.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3)
  const topVerse = [...verseSets.entries()]
    .map(([osis_ref, set]) => ({ osis_ref, count: set.size }))
    .sort((a, b) => b.count - a.count || a.osis_ref.localeCompare(b.osis_ref))[0]
  return {
    totalRefs: refs.length,
    distinctVerses: verseSets.size,
    topBooks,
    topVerse: topVerse ?? null,
  }
}

function returningFromRefs(refs: RefLike[], limit: number, bookOsis?: string): ReturningRef[] {
  const filtered = bookOsis ? refs.filter((r) => r.book_osis === bookOsis) : refs
  const sets = new Map<string, { book_osis: string; entries: Set<string> }>()
  for (const r of filtered) {
    const slot = sets.get(r.osis_ref) ?? { book_osis: r.book_osis, entries: new Set<string>() }
    slot.entries.add(r.entry_id)
    sets.set(r.osis_ref, slot)
  }
  return [...sets.entries()]
    .map(([osis_ref, v]) => ({ osis_ref, book_osis: v.book_osis, count: v.entries.size }))
    .sort((a, b) => b.count - a.count || a.osis_ref.localeCompare(b.osis_ref))
    .slice(0, limit)
}

export interface ScriptureCanonPage {
  heat: CanonHeat
  summary: SeasonSummary
  returning: ReturningRef[]
}

/** Lamp home — one ref pass for heat, summary, and returning (cached in memory). */
export async function loadScriptureCanonPage(
  window?: DateWindow,
  opts?: { fresh?: boolean },
): Promise<ScriptureCanonPage> {
  // App Store listing preview — see the matching note in features/ascent/data.
  // Seeding asyncCache instead would not be enough: ScriptureView still fires the
  // load, and its rejection sets loadError, which wins the render.
  if (import.meta.env.DEV && isListingPreview()) {
    return (await import('@/features/appstore/mock')).MOCK_CANON
  }

  const key = `scripture:canon:${windowCacheKey(window)}`
  if (!opts?.fresh) {
    const hit = getCache<ScriptureCanonPage>(key)
    if (hit) return hit
  }
  const refs = await loadRefs(window)
  const payload: ScriptureCanonPage = {
    heat: canonHeatFromRefs(refs),
    summary: seasonSummaryFromRefs(refs),
    returning: returningFromRefs(refs, 6),
  }
  setCache(key, payload)
  return payload
}

/** Per (book, chapter): distinct-entry count within the window. Returning across
 *  many sittings is the signal, so we count distinct entries, not raw mentions. */
export async function getCanonHeat(window?: DateWindow): Promise<CanonHeat> {
  return canonHeatFromRefs(await loadRefs(window))
}

/**
 * Top osis_refs by distinct-entry count — the "you keep returning to…" strip.
 * Pass `bookOsis` to scope to a single book (the book view's verse chips).
 */
export async function getReturning(
  limit = 6,
  window?: DateWindow,
  bookOsis?: string,
): Promise<ReturningRef[]> {
  return returningFromRefs(await loadRefs(window), limit, bookOsis)
}

/** How many faint, AI-inferred allusions await the user's nod in a window — the
 *  size of the confirm funnel. A head/count query (no rows shipped). */
export async function getSuggestedCount(window?: DateWindow): Promise<number> {
  const sb = requireSupabase()
  let q = sb
    .from('scripture_refs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'suggested')
  if (window?.from) q = q.gte('entry_created_at', window.from.toISOString())
  if (window?.to) q = q.lte('entry_created_at', window.to.toISOString())
  const { count, error } = await q
  if (error) return 0
  return count ?? 0
}

/** Entries touching a book, chronological, with the matched refs + an excerpt. */
export async function getBookEntries(bookOsis: string, window?: DateWindow): Promise<BookEntry[]> {
  const refs = (await loadRefs(window)).filter((r) => r.book_osis === bookOsis)
  return assembleEntries(refs)
}

/** Every entry where one exact verse/range surfaced — the "thread" behind a chip. */
export async function getVerseThread(osisRef: string, window?: DateWindow): Promise<BookEntry[]> {
  const refs = (await loadRefs(window)).filter((r) => r.osis_ref === osisRef)
  return assembleEntries(refs)
}

/**
 * Every moment one exact verse surfaced — both confirmed refs AND suggested
 * (AI-inferred) allusions — chronological, each with an excerpt from the source
 * entry. Unlike the heat/returning aggregations (confirmed only), this is the
 * Scripture drill-in's substrate, so it carries `status` + `ref_id` to drive the
 * quiet confirm affordance. Supabase-only: there is no offline fallback because
 * suggested refs live only in the table (they are never re-derived from prose).
 */
export async function getVerseMoments(osisRef: string, window?: DateWindow): Promise<VerseMoment[]> {
  const sb = requireSupabase()
  let q = sb
    .from('scripture_refs')
    .select('id, entry_id, entry_created_at, status, char_start')
    .eq('osis_ref', osisRef)
    .order('entry_created_at', { ascending: true })
  if (window?.from) q = q.gte('entry_created_at', window.from.toISOString())
  if (window?.to) q = q.lte('entry_created_at', window.to.toISOString())
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as {
    id: string
    entry_id: string
    entry_created_at: string
    status: RefStatus
    char_start: number | null
  }[]
  if (rows.length === 0) return []

  // Resolve bodies for excerpts (cache first, then fetch + warm — mirrors assembleEntries).
  const bodies = new Map<string, string>()
  const missing: string[] = []
  for (const id of new Set(rows.map((r) => r.entry_id))) {
    const cached = await cache.cacheGet(id)
    if (cached) bodies.set(id, cached.body_markdown)
    else missing.push(id)
  }
  if (missing.length > 0) {
    try {
      const fetched = await fetchEntriesByIds(missing)
      for (const e of fetched) bodies.set(e.id, e.body_markdown)
      if (fetched.length > 0) await cache.cachePutMany(fetched)
    } catch {
      // Offline — uncached entries simply show no excerpt.
    }
  }

  return rows.map((r) => ({
    ref_id: r.id,
    entry_id: r.entry_id,
    entry_created_at: r.entry_created_at,
    status: r.status,
    excerpt: excerptAround(bodies.get(r.entry_id) ?? '', r.char_start),
  }))
}

/** Group refs by entry, attach an excerpt from the entry body, chronological. */
async function assembleEntries(refs: RefLike[]): Promise<BookEntry[]> {
  const byEntry = new Map<string, RefLike[]>()
  for (const r of refs) {
    const list = byEntry.get(r.entry_id) ?? []
    list.push(r)
    byEntry.set(r.entry_id, list)
  }

  // Resolve bodies for the excerpts. The local cache only holds the most recent
  // ~500 entries (repo.sync), but the map references all of history — so fetch
  // the older bodies from Supabase and warm the cache, which also makes
  // "open in journal" work for those out-of-window entries.
  const bodies = new Map<string, string>()
  const missing: string[] = []
  for (const id of byEntry.keys()) {
    const cached = await cache.cacheGet(id)
    if (cached) bodies.set(id, cached.body_markdown)
    else missing.push(id)
  }
  if (missing.length > 0) {
    try {
      const fetched = await fetchEntriesByIds(missing)
      for (const e of fetched) bodies.set(e.id, e.body_markdown)
      if (fetched.length > 0) await cache.cachePutMany(fetched)
    } catch {
      // Offline — uncached entries simply show no excerpt.
    }
  }

  const out: BookEntry[] = []
  for (const [entryId, list] of byEntry) {
    const first = list[0]!
    out.push({
      entry_id: entryId,
      entry_created_at: first.entry_created_at,
      refs: list.map((r) => r.osis_ref),
      excerpt: excerptAround(bodies.get(entryId) ?? '', first.char_start),
    })
  }
  return out.sort((a, b) => a.entry_created_at.localeCompare(b.entry_created_at))
}

export interface SeasonSummary {
  /** Total ref rows in the window. */
  totalRefs: number
  /** Distinct verses/ranges in the window. */
  distinctVerses: number
  /** Books with the most distinct entries, busiest first (up to 3). */
  topBooks: { osis: string; name: string; count: number }[]
  /** The single most-returned-to verse/range, or null when the window is empty. */
  topVerse: { osis_ref: string; count: number } | null
}

/** Evidence for the one-line season note — described, never judged. */
export async function getSeasonSummary(window?: DateWindow): Promise<SeasonSummary> {
  return seasonSummaryFromRefs(await loadRefs(window))
}

export interface BookChapterHeat {
  /** chapter number → distinct-entry count. */
  chapters: Map<number, number>
  /** Busiest chapter's distinct-entry count, for normalizing the ramp. */
  max: number
}

/** Within-book chapter heat: distinct-entry count per chapter. */
export async function getBookChapterHeat(
  bookOsis: string,
  window?: DateWindow,
): Promise<BookChapterHeat> {
  const refs = (await loadRefs(window)).filter((r) => r.book_osis === bookOsis)
  const sets = new Map<number, Set<string>>()
  for (const r of refs) {
    ;(sets.get(r.chapter) ?? sets.set(r.chapter, new Set()).get(r.chapter)!).add(r.entry_id)
  }
  const chapters = new Map<number, number>()
  let max = 0
  for (const [c, set] of sets) {
    chapters.set(c, set.size)
    if (set.size > max) max = set.size
  }
  return { chapters, max }
}

export interface BookSummary {
  /** Distinct entries that reference this book in the window. */
  distinctEntries: number
  /** Earliest / latest reference date (ISO), or null when the book is unvisited. */
  firstDate: string | null
  lastDate: string | null
  /** 1-based rank among books by distinct-entry count (0 if unvisited). */
  rank: number
  /** How many books were touched at all (the denominator for "rank of"). */
  booksTouched: number
}

/** Header facts for the book view — counts, span, and rank among books. */
export async function getBookSummary(bookOsis: string, window?: DateWindow): Promise<BookSummary> {
  const refs = await loadRefs(window)
  const bookSets = new Map<string, Set<string>>()
  const mine = new Set<string>()
  let firstDate: string | null = null
  let lastDate: string | null = null
  for (const r of refs) {
    ;(bookSets.get(r.book_osis) ?? bookSets.set(r.book_osis, new Set()).get(r.book_osis)!).add(r.entry_id)
    if (r.book_osis === bookOsis) {
      mine.add(r.entry_id)
      if (firstDate === null || r.entry_created_at < firstDate) firstDate = r.entry_created_at
      if (lastDate === null || r.entry_created_at > lastDate) lastDate = r.entry_created_at
    }
  }
  const ranking = [...bookSets.entries()]
    .map(([osis, set]) => ({ osis, n: set.size }))
    .sort((a, b) => b.n - a.n || a.osis.localeCompare(b.osis))
  const rank = ranking.findIndex((x) => x.osis === bookOsis) + 1
  return { distinctEntries: mine.size, firstDate, lastDate, rank, booksTouched: bookSets.size }
}

const EXCERPT_RADIUS = 120

function excerptAround(body: string, charStart: number | null): string {
  if (!body) return ''
  const at = charStart ?? 0
  const start = Math.max(0, at - EXCERPT_RADIUS)
  const end = Math.min(body.length, at + EXCERPT_RADIUS)
  let slice = body.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) slice = `…${slice}`
  if (end < body.length) slice = `${slice}…`
  return slice
}
