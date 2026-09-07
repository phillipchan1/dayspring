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

import { requireSupabase } from '@/lib/supabase'
import { isListingPreview } from '@/lib/previewMode'
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

interface MemberRow {
  thread_id: string
  spiritual_item_id: string | null
  register: string
  spiritual_items: { content: string; created_at: string; entry_id: string | null } | null
}

function resolveLabel(t: { label?: string | null; label_ai?: string | null; label_user?: string | null }): string {
  return t.label_user ?? t.label_ai ?? t.label ?? ''
}

/** PostgREST default page cap. Both reads paginate past it — a caught-up owner
 *  can have thousands of declared threads (and a single 1000-id `.in()` filter
 *  overflows the request URL → 400, which is what hung the Altar at scale). */
const PAGE = 1000
/** Thread ids per member-query `.in(...)` — small enough to keep the URL short. */
const THREAD_IN_CHUNK = 80
/** Member chunks fetched at once. The chunks are independent, so running them in
 *  parallel turns a dozen+ serial round-trips into a few waves — the bulk of the
 *  old multi-second Altar load was latency stacking one chunk after another.
 *  Capped so a caught-up owner's many chunks don't flood the connection pool. */
const MEMBER_FETCH_CONCURRENCY = 6

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

/** Fetch all declared threads and their member lines (all-time). Heavy + paginated
 *  — called once per surface visit; windowing is a pure client-side derivation. */
export async function loadAltarSource(): Promise<AltarSource> {
  // App Store listing preview — see the matching note in features/ascent/data.
  // Kept inline under a literal `import.meta.env.DEV` so Vite drops the branch
  // and the dynamic import with it. Needed because AltarView's load rejection
  // sets loadError, which wins the render.
  if (import.meta.env.DEV && isListingPreview()) {
    return (await import('@/features/appstore/mock')).MOCK_ALTAR
  }

  const sb = requireSupabase()

  // All declared threads, paginated past the 1000-row cap.
  const threads: ThreadRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('threads')
      .select('id, label, label_ai, label_user, type, subject_kind')
      .eq('kind', 'declared')
      .eq('dismissed', false)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) { console.error('[altar] thread query', error.message); return EMPTY_SOURCE }
    const batch = (data ?? []) as ThreadRow[]
    threads.push(...batch)
    if (batch.length < PAGE) break
  }
  if (threads.length === 0) return EMPTY_SOURCE

  const meta = new Map(threads.map((t) => [t.id, t]))

  // Members — chunk the thread-id `.in(...)` (a 1000-id filter overflows the URL)
  // and paginate each chunk (a chunk's members can exceed one page). The chunks
  // are independent, so fetch them in concurrent waves rather than one at a time.
  const ids = threads.map((t) => t.id)
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += THREAD_IN_CHUNK) {
    chunks.push(ids.slice(i, i + THREAD_IN_CHUNK))
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
      if (error) { console.error('[altar] member query', error.message); return null }
      const batch = (data ?? []) as unknown as MemberRow[]
      for (const m of batch) {
        if (!m.spiritual_item_id || !m.spiritual_items) continue
        out.push({
          thread_id: m.thread_id,
          entry_id: m.spiritual_item_id, // surrogate: the line itself is the unit
          created_at: m.spiritual_items.created_at,
          body: m.spiritual_items.content,
        })
      }
      if (batch.length < PAGE) break
    }
    return out
  }

  const rawMembers: RawMember[] = []
  for (let i = 0; i < chunks.length; i += MEMBER_FETCH_CONCURRENCY) {
    const wave = chunks.slice(i, i + MEMBER_FETCH_CONCURRENCY)
    const results = await Promise.all(wave.map(fetchChunk))
    for (const r of results) {
      if (r === null) return EMPTY_SOURCE // a chunk errored — match the old fail-closed behavior
      rawMembers.push(...r)
    }
  }

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

  const rows = ((mdata ?? []) as unknown as MemberRow[]).filter((m) => m.spiritual_items)
  const moments: AltarMoment[] = rows
    .map((m) => ({
      itemId: m.spiritual_item_id ?? '',
      entryId: m.spiritual_items!.entry_id,
      date: m.spiritual_items!.created_at,
      excerpt: bandExcerpt(m.spiritual_items!.content, 240),
    }))
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
