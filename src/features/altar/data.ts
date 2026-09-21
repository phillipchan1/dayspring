/**
 * Altar data seam — the prayer/sense LENS on the unified Threads field.
 *
 * Altar reads the SAME `threads` table as the Ascent surface, filtered to
 * kind='declared' (the lines you marked /pray or /sense). Where derived threads
 * gather journal ENTRIES, a declared thread gathers the exact spiritual_item
 * lines, so members join through thread_members.spiritual_item_id. The abstract
 * warmth encoding (heft → thickness, hue → which part of life, pools → when it
 * gathered) is shared with Ascent via ./threads/data so the two never drift.
 */

import { assertSameOwner, cacheGeneration, onCacheCleared } from '@/lib/asyncCache'
import { requireSupabase } from '@/lib/supabase'
import { isCapturePreview } from '@/lib/previewMode'
import {
  buildBands, bandExcerpt, reframeFor,
  type RawThread, type RawMember,
} from '@/features/threads/data/bands'
import type { WarmthBand } from '@/features/threads/data/types'

export type AltarType = 'prayer' | 'sense'
export type SubjectKind = 'person' | 'place' | 'theme'

/** A declared subject rendered as an abstract strand on the Altar field. */
export interface AltarStrand extends WarmthBand {
  type: AltarType
  subjectKind: SubjectKind | null
}

/** One return to a subject — a verbatim /pray or /sense line in time. */
export interface AltarMoment {
  itemId: string
  /** Source entry id (for "open the entry"), if the line came from one. */
  entryId: string | null
  date: string
  excerpt: string
}

/** The click-in: a strand's whole tended life, line by line. */
export interface AltarStrandDetail {
  id: string
  label: string
  type: AltarType
  subjectKind: SubjectKind | null
  lenses: string[]
  heft: number
  pools: number[]
  spanStart: string
  spanEnd: string
  /** Deterministic reframe line — template, never LLM. */
  reframe: string
  moments: AltarMoment[]
}

interface ThreadRow {
  id: string
  label: string
  label_ai: string | null
  label_user: string | null
  type: AltarType
  subject_kind: SubjectKind | null
}

interface ItemEmbed {
  content: string
  created_at: string
  entry_id: string | null
}

interface MemberRow {
  thread_id: string
  spiritual_item_id: string | null
  register: string
  spiritual_items: ItemEmbed | ItemEmbed[] | null
}

function resolveLabel(t: { label?: string | null; label_ai?: string | null; label_user?: string | null }): string {
  return t.label_user ?? t.label_ai ?? t.label ?? ''
}

/** PostgREST default page cap. Both reads paginate past it — a caught-up owner
 *  can have thousands of declared threads (and a single 1000-id `.in()` filter
 *  overflows the request URL → 400, which is what hung the Altar at scale). */
const PAGE = 1000
/** Thread ids per fallback member-query `.in(...)` — small enough to keep the URL short. */
const THREAD_IN_CHUNK = 80
/** Pages (or fallback chunks) fetched at once. Capped so a caught-up owner's
 *  read doesn't flood the connection pool. */
const FETCH_CONCURRENCY = 6
const THREAD_COLUMNS = 'id, label, label_ai, label_user, type, subject_kind'
/** Members of declared threads, in one filtered read — no `.in(thread_id)` list,
 *  so the field doesn't fan out into a wave per 80 subjects. */
const MEMBER_COLUMNS =
  'id, thread_id, spiritual_item_id, register, spiritual_items!inner(content, created_at, entry_id), threads!inner(kind, dismissed)'

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
  count?: number | null
  /** Rows the server returned for this page, before any client-side skip. */
  received?: number
}

/**
 * The raw material for the Altar field: every declared thread plus its member
 * lines, fetched once. Windowing (season / year / …) then happens client-side in
 * buildAltarStrands, so changing the time range never re-hits the network — and,
 * crucially, each range produces strands whose heft / span / representative line
 * reflect THAT window, not the subject's whole life.
 */
export interface AltarSource {
  rawThreads: RawThread[]
  rawMembers: RawMember[]
  /** thread id → row, for type / subject_kind on the built strands. */
  meta: Map<string, ThreadRow>
}

/**
 * Build the field's strands windowed to a trailing range. A declared subject is
 * hued by its OWN label (trading, esther, purity…) rather than the uniform
 * prayer/sense lens, so the field reads as a spread of distinct lights. Sorted
 * thickest-first by buildBands; the caller groups by subject kind / filters type.
 *
 * Only RETURNED-to subjects surface (heft ≥ 2 WITHIN the window): a subject
 * brought once in the range isn't a strand there yet ("strands appear once you've
 * returned to them over time"), and the recurrence/span language assumes ≥2
 * moments. Pass windowStartMs = -Infinity for the all-time field.
 */
export function buildAltarStrands(src: AltarSource, windowStartMs: number): AltarStrand[] {
  const bands = buildBands(src.rawThreads, [], src.rawMembers, 4, Date.now(), windowStartMs)
  return bands
    .filter((b) => b.heft >= 2)
    .map((b): AltarStrand => {
      const t = src.meta.get(b.id)
      return {
        ...b,
        type: t?.type ?? 'prayer',
        subjectKind: t?.subject_kind ?? null,
        strandKind: 'declared',
      }
    })
}

/** Fetch all declared threads and their member lines (all-time). Windowing
 *  (season / year / …) then happens client-side in buildAltarStrands, so changing
 *  the time range never re-hits the network — and each range produces strands
 *  whose heft / span / representative line reflect THAT window.
 *
 *  The read itself is two filtered scans started together (the subjects, and
 *  their lines). Each is a count riding with its first page; further pages come
 *  back in parallel. It used to list every declared thread id and then `.in()`
 *  them 80 at a time; a caught-up altar is thousands of subjects, so that
 *  stacked a dozen round-trips before the first strand could paint. */
let inflight: Promise<AltarSource> | null = null

// A scrub (sign-out / owner change) drops the in-flight read with the cache, so
// the next caller can't join a read started by the previous owner.
onCacheCleared(() => {
  inflight = null
})

export async function loadAltarSource(): Promise<AltarSource> {
  // Marketing capture preview (App Store shots, ads, the flagship) — see the matching note in features/ascent/data.
  // Kept inline under a literal `import.meta.env.DEV` so Vite drops the branch
  // and the dynamic import with it. Needed because AltarView's load rejection
  // sets loadError, which wins the render.
  if (import.meta.env.DEV && isCapturePreview()) {
    return (await import('@/features/appstore/mock')).MOCK_ALTAR
  }

  // Two mounts racing (StrictMode, a fast re-nav) should cost one set of reads.
  // The finally must not clear a NEWER read: a sign-out drops `inflight` and the
  // next owner may already have started, and this promise is still the old one.
  if (inflight) return inflight
  let run: Promise<AltarSource>
  run = loadAltarSourceOnce().finally(() => {
    if (inflight === run) inflight = null
  })
  inflight = run
  return run
}

async function loadAltarSourceOnce(): Promise<AltarSource> {
  const gen = cacheGeneration()
  const sb = requireSupabase()

  // Threads and lines are independent filters, so they run together. A cold open
  // that fits in one page costs one round-trip of latency, not a walk of every subject.
  const [threads, embeddedMembers] = await Promise.all([
    fetchDeclaredThreads(sb),
    fetchEmbeddedMembers(sb),
  ])
  assertSameOwner(gen)

  if (threads === null) {
    console.error('[altar] thread query failed')
    throw new Error('Could not load')
  }
  if (threads.length === 0) return EMPTY_SOURCE

  let rawMembers = embeddedMembers
  if (rawMembers === null) {
    // The embedded filter is the fast path. If PostgREST can't resolve the
    // relationship, keep the altar readable via the older id-list reads.
    console.warn('[altar] embedded member read failed; falling back to chunked reads')
    rawMembers = await fetchChunkedMembers(sb, threads.map((t) => t.id))
    assertSameOwner(gen)
  }
  if (rawMembers === null) {
    console.error('[altar] member query failed')
    throw new Error('Could not load')
  }

  const meta = new Map(threads.map((t) => [t.id, t]))
  // Map the declared model onto the shared band builder: the subject LABEL drives
  // hue; each spiritual_item line stands in for an "entry" (its id is unique, so
  // heft counts lines correctly). domain/rope are null — declared strands stand
  // alone (no ropes on the Altar lens yet).
  const rawThreads: RawThread[] = threads.map((t) => ({
    id: t.id,
    lens: resolveLabel(t),
    domain: null,
    rope_id: null,
    label: resolveLabel(t),
    label_ai: t.label_ai,
    label_user: t.label_user,
    private: false,
    dismissed: false,
  }))

  return { rawThreads, rawMembers, meta }
}

type SB = ReturnType<typeof requireSupabase>

/** Page 0 rides with the count. A short page is the whole table; a full one
 *  fetches the rest in waves sized by the count (or serially, if the count
 *  itself failed). `received` is the server row count — client filtering must
 *  not look like the last page. */
async function readPages<T>(
  count: () => Promise<PageResult<T>>,
  page: (from: number) => Promise<PageResult<T>>,
): Promise<T[] | null> {
  const [first, counted] = await Promise.all([page(0), count()])
  if (first.error) {
    console.error('[altar] page', first.error.message)
    return null
  }
  const rows = [...(first.data ?? [])]
  const received = first.received ?? rows.length
  if (received < PAGE) return rows

  const total = counted.error ? null : counted.count ?? null
  if (total == null) {
    for (let from = PAGE; ; from += PAGE) {
      const next = await page(from)
      if (next.error) {
        console.error('[altar] page', next.error.message)
        return null
      }
      rows.push(...(next.data ?? []))
      const got = next.received ?? next.data?.length ?? 0
      if (got < PAGE) break
    }
    return rows
  }

  const pages = Math.ceil(total / PAGE)
  for (let p = 1; p < pages; p += FETCH_CONCURRENCY) {
    const froms: number[] = []
    for (let i = p; i < Math.min(pages, p + FETCH_CONCURRENCY); i++) froms.push(i * PAGE)
    const results = await Promise.all(froms.map((from) => page(from)))
    for (const r of results) {
      if (r.error) {
        console.error('[altar] page', r.error.message)
        return null
      }
      rows.push(...(r.data ?? []))
    }
  }
  return rows
}

async function fetchDeclaredThreads(sb: SB): Promise<ThreadRow[] | null> {
  return readPages(
    async () => {
      const { count, error } = await sb
        .from('threads')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'declared')
        .eq('dismissed', false)
      return { data: null, error, count }
    },
    async (from) => {
      const { data, error } = await sb
        .from('threads')
        .select(THREAD_COLUMNS)
        .eq('kind', 'declared')
        .eq('dismissed', false)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      const batch = (data ?? []) as ThreadRow[]
      return { data: batch, error, received: batch.length }
    },
  )
}

function oneItem(value: MemberRow['spiritual_items']): ItemEmbed | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function toRawMembers(rows: MemberRow[]): { members: RawMember[]; received: number } {
  const members: RawMember[] = []
  for (const m of rows) {
    const item = oneItem(m.spiritual_items)
    if (!m.spiritual_item_id || !item) continue
    members.push({
      thread_id: m.thread_id,
      entry_id: m.spiritual_item_id, // surrogate: the line itself is the unit
      created_at: item.created_at,
      body: item.content,
    })
  }
  return { members, received: rows.length }
}

async function fetchEmbeddedMembers(sb: SB): Promise<RawMember[] | null> {
  const pages = await readPages(
    async () => {
      const { count, error } = await sb
        .from('thread_members')
        .select('id, threads!inner(kind, dismissed)', { count: 'exact', head: true })
        .eq('threads.kind', 'declared')
        .eq('threads.dismissed', false)
        .not('spiritual_item_id', 'is', null)
      return { data: null, error, count }
    },
    async (from) => {
      const { data, error } = await sb
        .from('thread_members')
        .select(MEMBER_COLUMNS)
        .eq('threads.kind', 'declared')
        .eq('threads.dismissed', false)
        .not('spiritual_item_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) return { data: null, error }
      const mapped = toRawMembers((data ?? []) as unknown as MemberRow[])
      return { data: mapped.members, error: null, received: mapped.received }
    },
  )
  return pages
}

/** Older path: `.in(thread_id)` in short chunks. Used only when the embedded
 *  filter is rejected. A chunk that errors fails the whole read — a partial
 *  field would look like prayers that aren't there. */
async function fetchChunkedMembers(sb: SB, threadIds: string[]): Promise<RawMember[] | null> {
  const chunks: string[][] = []
  for (let i = 0; i < threadIds.length; i += THREAD_IN_CHUNK) {
    chunks.push(threadIds.slice(i, i + THREAD_IN_CHUNK))
  }

  const fetchChunk = async (chunk: string[]): Promise<RawMember[] | null> => {
    const out: RawMember[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('thread_members')
        .select('id, thread_id, spiritual_item_id, register, spiritual_items(content, created_at, entry_id)')
        .in('thread_id', chunk)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[altar] member query', error.message)
        return null
      }
      const mapped = toRawMembers((data ?? []) as unknown as MemberRow[])
      out.push(...mapped.members)
      if (mapped.received < PAGE) break
    }
    return out
  }

  const rawMembers: RawMember[] = []
  for (let i = 0; i < chunks.length; i += FETCH_CONCURRENCY) {
    const wave = chunks.slice(i, i + FETCH_CONCURRENCY)
    const results = await Promise.all(wave.map(fetchChunk))
    for (const r of results) {
      if (r === null) return null
      rawMembers.push(...r)
    }
  }
  return rawMembers
}

const EMPTY_SOURCE: AltarSource = { rawThreads: [], rawMembers: [], meta: new Map() }

/** A single strand's whole life — every line in time, for the click-in panel. */
export async function loadAltarStrand(id: string): Promise<AltarStrandDetail | null> {
  const sb = requireSupabase()

  const { data: tdata } = await sb
    .from('threads')
    .select('id, label, label_ai, label_user, type, subject_kind')
    .eq('id', id)
    .maybeSingle()
  if (!tdata) return null
  const t = tdata as ThreadRow

  const { data: mdata, error } = await sb
    .from('thread_members')
    .select('spiritual_item_id, register, spiritual_items(content, created_at, entry_id)')
    .eq('thread_id', id)
  if (error) { console.error('[altar] strand detail query', error.message); return null }

  const moments: AltarMoment[] = ((mdata ?? []) as unknown as MemberRow[])
    .flatMap((m) => {
      const item = oneItem(m.spiritual_items)
      if (!item) return []
      return [{
        itemId: m.spiritual_item_id ?? '',
        entryId: item.entry_id,
        date: item.created_at,
        excerpt: bandExcerpt(item.content, 240),
      }]
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  if (moments.length === 0) return null

  const spanStart = moments[0]!.date
  const spanEnd = moments[moments.length - 1]!.date

  // pools over the strand's own span (mirrors buildTended's mini-encoding).
  const N = Math.min(8, Math.max(1, moments.length))
  const t0 = Date.parse(spanStart)
  const span = Math.max(1, Date.parse(spanEnd) - t0)
  const counts = new Array(N).fill(0)
  for (const m of moments) {
    const idx = Math.min(N - 1, Math.max(0, Math.floor(((Date.parse(m.date) - t0) / span) * N)))
    counts[idx]++
  }
  const peak = Math.max(...counts, 1)

  return {
    id: t.id,
    label: resolveLabel(t),
    type: t.type ?? 'prayer',
    subjectKind: t.subject_kind ?? null,
    lenses: [resolveLabel(t)],
    heft: moments.length,
    pools: counts.map((c) => c / peak),
    spanStart,
    spanEnd,
    reframe: reframeFor(spanStart, spanEnd, moments.length, false),
    moments,
  }
}
