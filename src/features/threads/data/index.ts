/**
 * Threads & Ropes data seam.
 *
 * loadThreads() queries the real `threads` table (written by scripts/derive-threads.ts).
 * Connection candidates and encounter naming remain on mock fixtures for now.
 *
 * Swapping remaining dimensions:
 *   - Candidates  → similarity-search query against threads table
 *   - Encounters  → encounters table reads (same table as Altar)
 */

import { requireSupabase } from '@/lib/supabase'
import type { Horizon, Strand, ThreadComp, ThreadsData } from './types'
import { MOCK_CANDIDATES } from './fixtures'

/** Max strands shown in the field; the rest become the "N resting" count. */
const FIELD_MAX = 5

// ── horizon → date window ──────────────────────────────────────────────────

const HORIZON_DAYS: Record<Horizon, number | null> = {
  0: 7,
  1: 31,
  2: 91,
  3: 365,
  4: null, // all time
}

// ── DB row shape ──────────────────────────────────────────────────────────────

interface ThreadDbRow {
  id: string
  label: string
  lenses: string[]
  member_entry_ids: string[]
  weight: number
  breadth: number
  span_start: string | null
  span_end: string | null
  sim_threshold: number | null
  one_line_why: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatSpan(start: string | null, end: string | null): string {
  if (!start) return ''
  const from = start.slice(0, 7) // "2024-03"
  const toYear = end?.slice(0, 4) ?? ''
  const nowYear = new Date().getFullYear().toString()
  return toYear === nowYear ? `${from.slice(5, 7)}/${from.slice(0, 4)}→` : `${from.slice(0, 4)}→`
}

function temperature(spanEnd: string | null): number {
  if (!spanEnd) return 0.1
  const msAgo = Date.now() - new Date(spanEnd).getTime()
  const daysAgo = msAgo / (1000 * 60 * 60 * 24)
  // 1.0 = active this week, 0.1 = dormant > 1 year
  return Math.max(0.1, Math.min(1.0, 1 - daysAgo / 365))
}

function rowToStrand(row: ThreadDbRow): Strand {
  const span = formatSpan(row.span_start, row.span_end)
  const comps: ThreadComp[] = row.lenses.map((lens, i) => ({
    id: `${row.id}-${i}`,
    lens,
    span,
    // matter + moments are loaded lazily (TODO: per-lens entry drill)
    matter: row.one_line_why ?? '',
    moments: [],
  }))

  return {
    id: row.id,
    label: row.label,
    kind: row.breadth >= 2 ? 'rope' : 'thread',
    declared: false, // TODO: wire encounter declarations from encounters table
    comps,
    weight: row.weight,
    breadth: row.breadth,
    span: {
      from: row.span_start ?? '',
      to: row.span_end ?? '',
    },
    temperature: temperature(row.span_end),
  }
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Load threads for the given horizon from the real `threads` table.
 * Falls back to empty on error — the surface degrades gracefully.
 */
export async function loadThreads(horizon: Horizon): Promise<ThreadsData> {
  const sb = requireSupabase()
  const days = HORIZON_DAYS[horizon]

  let q = sb
    .from('threads')
    .select('id, label, lenses, member_entry_ids, weight, breadth, span_start, span_end, sim_threshold, one_line_why')
    .order('weight', { ascending: false })

  // Horizon filter: thread must have been "alive" during the window.
  // span_end >= window_start means it was active at some point in the window.
  if (days !== null) {
    const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    q = q.gte('span_end', windowStart)
  }

  const { data, error } = await q
  if (error) {
    console.error('[threads] query error', error.message)
    return { strands: [], restingCount: 0, candidates: [] }
  }

  const rows = (data ?? []) as ThreadDbRow[]
  const all = rows.map(rowToStrand)
  const visible = all.slice(0, FIELD_MAX)
  const resting = all.slice(FIELD_MAX)

  // Connection candidates — still mock; filtered to visible strands.
  // TODO: wire real data — similarity query between thread centroids
  const candidates = MOCK_CANDIDATES.filter(
    (c) => visible.some((s) => s.id === c.threadA) && visible.some((s) => s.id === c.threadB),
  )

  return { strands: visible, restingCount: resting.length, candidates }
}

export type { Horizon, ThreadsData, Strand }
export { FIELD_MAX }
