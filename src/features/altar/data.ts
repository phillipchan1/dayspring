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

/**
 * All declared strands as abstract warmth bands, all-time. A declared subject is
 * hued by its OWN label (trading, esther, purity…) rather than the uniform
 * prayer/sense lens, so the field reads as a spread of distinct lights. Sorted
 * thickest-first by buildBands; the caller groups by subject kind / filters type.
 */
export async function loadAltarStrands(): Promise<AltarStrand[]> {
  const sb = requireSupabase()

  const { data: tdata, error: terr } = await sb
    .from('threads')
    .select('id, label, label_ai, label_user, type, subject_kind')
    .eq('kind', 'declared')
    .eq('dismissed', false)
  if (terr) { console.error('[altar] thread query', terr.message); return [] }
  const threads = (tdata ?? []) as ThreadRow[]
  if (threads.length === 0) return []

  const meta = new Map(threads.map((t) => [t.id, t]))
  const { data: mdata, error: merr } = await sb
    .from('thread_members')
    .select('thread_id, spiritual_item_id, register, spiritual_items(content, created_at, entry_id)')
    .in('thread_id', threads.map((t) => t.id))
  if (merr) { console.error('[altar] member query', merr.message); return [] }

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

  const rawMembers: RawMember[] = ((mdata ?? []) as unknown as MemberRow[])
    .filter((m) => m.spiritual_item_id && m.spiritual_items)
    .map((m) => ({
      thread_id: m.thread_id,
      entry_id: m.spiritual_item_id!,            // surrogate: the line itself is the unit
      created_at: m.spiritual_items!.created_at,
      body: m.spiritual_items!.content,
    }))

  const bands = buildBands(rawThreads, [], rawMembers, 4, Date.now())

  return bands.map((b): AltarStrand => {
    const t = meta.get(b.id)
    return {
      ...b,
      type: t?.type ?? 'prayer',
      subjectKind: t?.subject_kind ?? null,
      strandKind: 'declared',
    }
  })
}

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
