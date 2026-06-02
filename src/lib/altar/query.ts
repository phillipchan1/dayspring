// All Supabase reads for the Altar surface. The view, the cairn math, and the
// arc geometry stay free of supabase imports.
//
// Threads, encounters, and candidates are produced server-side (backfill + daily
// cron) and read here as plain rows — no vector ops at read time. RLS scopes
// every read to the owner. Unlike the Scripture surface there's no offline
// derive-from-cache fallback: threads only exist once the server has clustered
// them, so when Supabase is unreachable the surface shows its error/empty state
// rather than a half-truth.

import { requireSupabase } from '../supabase'
import type { AltarCandidate, Encounter, Movement, PrayerThread } from '../types'

export interface DateWindow {
  from?: Date
  to?: Date
}

// PrayerThread fields EXCEPT the server-only `embedding` vector — never ship it
// to the client (mirrors ENTRY_COLUMNS / ITEM_COLUMNS).
const THREAD_COLUMNS = 'id, owner, title, carries, planted_at, last_touch_at, seed_item_id, created_at'

export type ThreadState = 'lit' | 'carrying' | 'seed'

/** One touch of a prayer — the seed or a return. */
export interface Touch {
  id: string
  type: 'prayer' | 'sense'
  content: string
  date: string // entry date when linked, else the row's created_at
  entry_id: string | null
}

/** A cairn: a thread plus its derived light state. */
export interface AltarThread {
  id: string
  title: string
  type: 'prayer' | 'sense'
  carries: string[]
  planted_at: string
  last_touch_at: string
  touches: number // 1 (seed) + returns
  state: ThreadState
  movement: Movement | null
  named_at: string | null
  reflection: string | null
  hasCandidate: boolean
}

/** Full thread for the click-in panel. */
export interface ThreadDetail extends AltarThread {
  seed: Touch | null
  returns: Touch[] // chronological, after the seed
  encounter: Encounter | null
  candidate: AltarCandidate | null
}

const PAGE = 1000
// Max ids per `.in('id', [...])` — a long list overflows PostgREST's URL → 400.
const IN_CHUNK = 150

function inWindowClause(q: any, window?: DateWindow) {
  // Season scrubber filters by when the prayer was PLANTED.
  if (window?.from) q = q.gte('planted_at', window.from.toISOString())
  if (window?.to) q = q.lte('planted_at', window.to.toISOString())
  return q
}

interface ItemRow {
  id: string
  thread_id: string | null
  type: 'prayer' | 'sense' | 'scripture'
  content: string
  created_at: string
  entry_id: string | null
}

/** Members (touches) for a set of threads, keyed by thread id, each list chronological. */
async function loadMembers(threadIds: string[]): Promise<Map<string, Touch[]>> {
  const sb = requireSupabase()
  const byThread = new Map<string, ItemRow[]>()
  // Chunk the thread_id IN-list (a long list overflows PostgREST's URL → 400) AND
  // paginate rows (a busy set of threads has far more than the 1000-row cap).
  for (let i = 0; i < threadIds.length; i += IN_CHUNK) {
    const slice = threadIds.slice(i, i + IN_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('spiritual_items')
        .select('id, thread_id, type, content, created_at, entry_id')
        .in('thread_id', slice)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as ItemRow[]
      for (const r of rows) {
        if (!r.thread_id) continue
        ;(byThread.get(r.thread_id) ?? byThread.set(r.thread_id, []).get(r.thread_id)!).push(r)
      }
      if (rows.length < PAGE) break
    }
  }
  // Resolve entry dates so a touch reads as its source date, not its row date.
  const entryIds = [
    ...new Set(
      [...byThread.values()].flat().map((r) => r.entry_id).filter((x): x is string => !!x),
    ),
  ]
  const entryDate = new Map<string, string>()
  for (let i = 0; i < entryIds.length; i += IN_CHUNK) {
    const { data } = await sb
      .from('entries')
      .select('id, created_at')
      .in('id', entryIds.slice(i, i + IN_CHUNK))
    for (const e of (data ?? []) as { id: string; created_at: string }[]) entryDate.set(e.id, e.created_at)
  }
  const out = new Map<string, Touch[]>()
  for (const [tid, rows] of byThread) {
    const touches: Touch[] = rows.map((r) => ({
      id: r.id,
      type: r.type === 'sense' ? 'sense' : 'prayer',
      content: r.content,
      date: (r.entry_id && entryDate.get(r.entry_id)) || r.created_at,
      entry_id: r.entry_id,
    }))
    touches.sort((a, b) => a.date.localeCompare(b.date))
    out.set(tid, touches)
  }
  return out
}

function deriveState(touches: number, encounter: Encounter | null): ThreadState {
  if (encounter) return 'lit'
  return touches > 1 ? 'carrying' : 'seed'
}

function toAltarThread(
  t: PrayerThread,
  touches: Touch[],
  encounter: Encounter | null,
  hasCandidate: boolean,
): AltarThread {
  const seed = touches[0]
  return {
    id: t.id,
    title: t.title,
    type: seed?.type ?? 'prayer',
    carries: t.carries ?? [],
    planted_at: t.planted_at,
    last_touch_at: t.last_touch_at,
    touches: touches.length || 1,
    state: deriveState(touches.length || 1, encounter),
    movement: encounter?.movement ?? null,
    named_at: encounter?.named_at ?? null,
    reflection: encounter?.reflection_text ?? null,
    hasCandidate,
  }
}

/** Cheap count of cairns planted in a window — drives the adaptive default season. */
export async function countThreads(window?: DateWindow): Promise<number> {
  const sb = requireSupabase()
  let q = sb.from('prayer_threads').select('id', { count: 'exact', head: true })
  q = inWindowClause(q, window)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

/** Every thread in the window, with derived light state. The Field/Time hero data. */
export async function listThreads(window?: DateWindow): Promise<AltarThread[]> {
  const sb = requireSupabase()
  const threads: PrayerThread[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from('prayer_threads')
      .select(THREAD_COLUMNS)
      .order('last_touch_at', { ascending: false })
      .range(from, from + PAGE - 1)
    q = inWindowClause(q, window)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as PrayerThread[]
    threads.push(...rows)
    if (rows.length < PAGE) break
  }
  if (threads.length === 0) return []

  const ids = threads.map((t) => t.id)
  const [members, encounters, candidateIds] = await Promise.all([
    loadMembers(ids),
    sb.from('encounters').select('*').in('thread_id', ids),
    sb.from('altar_candidates').select('thread_id').in('thread_id', ids),
  ])
  const encByThread = new Map<string, Encounter>()
  for (const e of (encounters.data ?? []) as Encounter[]) encByThread.set(e.thread_id, e)
  const withCandidate = new Set(
    ((candidateIds.data ?? []) as { thread_id: string }[]).map((c) => c.thread_id),
  )

  return threads.map((t) =>
    toAltarThread(t, members.get(t.id) ?? [], encByThread.get(t.id) ?? null, withCandidate.has(t.id)),
  )
}

/** The full thread for the click-in panel: seed, returns, encounter, candidate. */
export async function getThread(id: string): Promise<ThreadDetail | null> {
  const sb = requireSupabase()
  const { data: row, error } = await sb.from('prayer_threads').select(THREAD_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!row) return null
  const thread = row as PrayerThread

  const [members, encRes, candRes] = await Promise.all([
    loadMembers([id]),
    sb.from('encounters').select('*').eq('thread_id', id).maybeSingle(),
    sb.from('altar_candidates').select('*').eq('thread_id', id).maybeSingle(),
  ])
  const touches = members.get(id) ?? []
  const encounter = (encRes.data as Encounter | null) ?? null
  const candidate = (candRes.data as AltarCandidate | null) ?? null

  const base = toAltarThread(thread, touches, encounter, candidate !== null)
  return {
    ...base,
    seed: touches[0] ?? null,
    returns: touches.slice(1),
    encounter,
    candidate,
  }
}

export interface CarriedName {
  name: string
  count: number
}

/** "The names you keep bringing to God" — intercession targets across threads, by count. */
export async function getCarries(window?: DateWindow): Promise<CarriedName[]> {
  const sb = requireSupabase()
  let q = sb.from('prayer_threads').select('carries')
  q = inWindowClause(q, window)
  const { data, error } = await q
  if (error) throw error
  const tally = new Map<string, number>()
  for (const row of (data ?? []) as { carries: string[] | null }[]) {
    for (const name of row.carries ?? []) {
      const key = name.trim()
      if (key) tally.set(key, (tally.get(key) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
