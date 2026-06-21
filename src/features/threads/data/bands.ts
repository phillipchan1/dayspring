/**
 * Warmth-band aggregation — PURE, dependency-free.
 *
 * The same ropes (and standalone threads) persist at every altitude and thicken
 * as the window widens. This module windows raw thread_members up to a horizon
 * and emits the abstract encoding (heft → thickness, lenses → hue, pools → glow,
 * repLine → a SELECTED member line). No counts leave this layer in UI form; heft
 * is felt, not numbered. Shared by the client seam (getRopesAtHorizon) and the
 * offline verify script so the two can never drift.
 */

import type { Horizon, WarmthBand, RepLine, MomentItem, Register } from './types'

/** Trailing window width per horizon, literal-today anchored. 4 = all time. */
export const HORIZON_DAYS: Record<Horizon, number | null> = {
  0: 7,    // Valley   — week
  1: 31,   // Hillside — month
  2: 91,   // Ridge    — quarter
  3: 365,  // Summit   — year
  4: null, // all time
}

/** Sub-period buckets per horizon (days · weeks · months · months). */
const POOL_BUCKETS: Record<Horizon, number> = { 0: 7, 1: 4, 2: 3, 3: 12, 4: 12 }

export interface RawThread {
  id: string
  /** Free-text classifier output — unreliable for hue; prefer domain / rope label. */
  lens: string | null
  /** Clean stewardship-domain key (Trading/Frontier/Family/Health/SCE) or null. */
  domain: string | null
  rope_id: string | null
  label: string
  label_ai: string | null
  label_user: string | null
  private: boolean
  dismissed: boolean
}

export interface RawRope {
  id: string
  label: string
  label_user: string | null
}

/** One thread_member joined to its (non-superseded) entry. */
export interface RawMember {
  thread_id: string
  entry_id: string
  created_at: string
  body: string
}

function resolveThreadLabel(t: RawThread): string {
  return t.label_user ?? t.label_ai ?? t.label ?? ''
}

/** Light verbatim slice — strips markdown headings, image/location noise, and
 *  prayer openers, then trims. Never rewrites prose. */
export function bandExcerpt(body: string, max = 180): string {
  const stripped = (body ?? '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(diarly:\/\/[^)]+\)/g, '')
    .replace(/^#+\s*/m, '')
    .replace(/^(morning\s+(jesus|god|lord)|dear\s+(god|lord|jesus|father))[,.\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length <= max ? stripped : stripped.slice(0, max - 1) + '…'
}

// ── tended timeline (the click-in) — PURE ─────────────────────────────────────

/** Deterministic reframe line — template, never LLM. */
export function reframeFor(spanStart: string, spanEnd: string, _memberCount: number, hasMeeting: boolean): string {
  const days = (Date.parse(spanEnd) - Date.parse(spanStart)) / 86_400_000
  const years = Math.floor(days / 365)
  const months = Math.floor(days / 30)
  const meetingSuffix = hasMeeting ? ' — and you weren\'t the only one who kept showing up.' : '.'
  if (days < 60) return 'A current weight — recent, still being carried.'
  if (days < 180) return `You've returned here across ${months} months. Each return is the thread.`
  if (years < 1) return `${months} months of returning to this. The thread is the returning${meetingSuffix}`
  if (years < 3) return `You've returned here across ${years === 1 ? 'a year' : `${years} years`}. Each time the thread stayed.`
  return `You've come back to this for ${years} years. The returning is its own faithfulness${meetingSuffix}`
}

/** One member of a band, joined to its non-superseded entry. */
export interface RawTendedMember {
  entryId: string
  created_at: string
  register: string
  body: string
}

const REGISTER_RANK: Record<string, number> = { meeting: 2, bringing: 1, neutral: 0 }

export interface Tended {
  heft: number
  pools: number[]
  reframe: string
  moments: MomentItem[]
}

/**
 * Assemble a band's full tended life from its raw members: dedupe by entry
 * (keeping the strongest register: meeting > bringing > neutral), order by date,
 * recompute the mini-encoding pools over the band's own span, and pick the
 * deterministic reframe. Pure — windowing/queries live in the caller.
 */
export function buildTended(raw: RawTendedMember[]): Tended | null {
  const byEntry = new Map<string, RawTendedMember>()
  for (const m of raw) {
    const prev = byEntry.get(m.entryId)
    const reg = m.register ?? 'neutral'
    if (prev && (REGISTER_RANK[prev.register] ?? 0) >= (REGISTER_RANK[reg] ?? 0)) continue
    byEntry.set(m.entryId, { ...m, register: reg })
  }
  const ordered = [...byEntry.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  if (ordered.length === 0) return null

  const moments: MomentItem[] = ordered.map((m) => ({
    entryId: m.entryId, date: m.created_at, register: (m.register as Register), excerpt: bandExcerpt(m.body),
  }))
  const spanStart = ordered[0]!.created_at
  const spanEnd = ordered[ordered.length - 1]!.created_at

  const N = Math.min(8, Math.max(1, ordered.length))
  const t0 = Date.parse(spanStart)
  const span = Math.max(1, Date.parse(spanEnd) - t0)
  const counts = new Array(N).fill(0)
  for (const m of ordered) {
    const idx = Math.min(N - 1, Math.max(0, Math.floor(((Date.parse(m.created_at) - t0) / span) * N)))
    counts[idx]++
  }
  const peak = Math.max(...counts, 1)

  return {
    heft: moments.length,
    pools: counts.map((c) => c / peak),
    reframe: reframeFor(spanStart, spanEnd, moments.length, moments.some((m) => m.register === 'meeting')),
    moments,
  }
}

interface BandSeed {
  id: string
  kind: 'rope' | 'thread'
  label: string
  private: boolean
  threadIds: Set<string>
  lensByThread: Map<string, string | null>
}

/**
 * Window raw thread_members up to `horizon` (relative to nowMs) and build the
 * warmth bands: ropes (≥2 visible threads) plus standalone threads. Bands with
 * no members in the window rest (omitted). Non-private bands sort thickest-first;
 * private bands trail, never ranked.
 */
export function buildBands(
  threads: RawThread[],
  ropes: RawRope[],
  members: RawMember[],
  horizon: Horizon,
  nowMs: number,
  /** Arbitrary trailing-window start (ms). Overrides the horizon's window when
   *  given — lets a caller window to a span the Horizon enum can't name (e.g. the
   *  Altar's 5-/10-year ranges). The horizon still drives the pool-bucket count. */
  windowStartMs?: number,
): WarmthBand[] {
  const days = HORIZON_DAYS[horizon]
  const windowStart =
    windowStartMs !== undefined ? windowStartMs : days === null ? -Infinity : nowMs - days * 86_400_000

  // Clean hue signal per thread: domain (taxonomy key) ?? rope label (clean) ??
  // lens (free-text fallback). The raw `lens` column is often a full description
  // or a topic phrase, so it can't drive hue on its own.
  const ropeLabelById = new Map(ropes.map((r) => [r.id, r.label_user ?? r.label]))
  const hueLens = (t: RawThread): string | null => {
    if (t.domain) return t.domain
    if (t.rope_id) {
      const rl = ropeLabelById.get(t.rope_id)
      if (rl) return rl
    }
    return t.lens
  }

  // Visible threads only (engine drops dismissed).
  const visible = threads.filter((t) => !t.dismissed)

  // A rope is a band only if it groups ≥2 visible threads.
  const threadsByRope = new Map<string, RawThread[]>()
  for (const t of visible) {
    if (!t.rope_id) continue
    const arr = threadsByRope.get(t.rope_id) ?? []
    arr.push(t)
    threadsByRope.set(t.rope_id, arr)
  }
  const liveRopeIds = new Set(
    [...threadsByRope.entries()].filter(([, ts]) => ts.length >= 2).map(([id]) => id),
  )

  const seeds: BandSeed[] = []
  for (const rope of ropes) {
    if (!liveRopeIds.has(rope.id)) continue
    const ts = threadsByRope.get(rope.id)!
    seeds.push({
      id: rope.id,
      kind: 'rope',
      label: rope.label_user ?? rope.label,
      private: false,
      threadIds: new Set(ts.map((t) => t.id)),
      lensByThread: new Map(ts.map((t) => [t.id, hueLens(t)])),
    })
  }
  for (const t of visible) {
    if (t.rope_id && liveRopeIds.has(t.rope_id)) continue // folded into its rope
    seeds.push({
      id: t.id,
      kind: 'thread',
      label: resolveThreadLabel(t),
      private: t.private,
      threadIds: new Set([t.id]),
      lensByThread: new Map([[t.id, hueLens(t)]]),
    })
  }

  // Index windowed members by thread.
  const windowedByThread = new Map<string, RawMember[]>()
  for (const m of members) {
    const t = Date.parse(m.created_at)
    if (!Number.isFinite(t) || t < windowStart || t > nowMs) continue
    const arr = windowedByThread.get(m.thread_id) ?? []
    arr.push(m)
    windowedByThread.set(m.thread_id, arr)
  }

  const bands: WarmthBand[] = []
  for (const seed of seeds) {
    // Gather windowed members across the band's threads (dedupe by entry — a rope
    // can share an entry across threads; an entry counts once toward heft).
    const seen = new Set<string>()
    const mems: { time: number; iso: string; body: string; entryId: string }[] = []
    const lenses = new Set<string>()
    for (const tid of seed.threadIds) {
      for (const m of windowedByThread.get(tid) ?? []) {
        if (seen.has(m.entry_id)) continue
        seen.add(m.entry_id)
        mems.push({ time: Date.parse(m.created_at), iso: m.created_at, body: m.body, entryId: m.entry_id })
        const lens = seed.lensByThread.get(tid)
        if (lens) lenses.add(lens)
      }
    }
    if (mems.length === 0) continue

    mems.sort((a, b) => a.time - b.time)
    const heft = mems.length

    // pools — bucket across [bucketStart, now]; intensity = count ÷ peak bucket.
    const nB = POOL_BUCKETS[horizon]
    const bucketStart = Number.isFinite(windowStart) ? windowStart : mems[0]!.time
    const spanMs = Math.max(1, nowMs - bucketStart)
    const counts = new Array(nB).fill(0)
    for (const m of mems) {
      const idx = Math.min(nB - 1, Math.max(0, Math.floor(((m.time - bucketStart) / spanMs) * nB)))
      counts[idx]++
    }
    const peak = Math.max(...counts, 1)
    const pools = counts.map((c) => c / peak)

    // repLine — temporal median (most central in time). Selection, not generation.
    const mid = mems[Math.floor((mems.length - 1) / 2)]!
    const repLine: RepLine = { entryId: mid.entryId, date: mid.iso, excerpt: bandExcerpt(mid.body) }

    bands.push({
      id: seed.id,
      kind: seed.kind,
      label: seed.label,
      private: seed.private,
      heft,
      lenses: [...lenses],
      pools,
      repLine,
      spanStart: mems[0]!.iso,
      spanEnd: mems[mems.length - 1]!.iso,
    })
  }

  // Thickest-first; private bands trail and are never ranked among the rest.
  const open = bands.filter((b) => !b.private).sort((a, b) => b.heft - a.heft)
  const priv = bands.filter((b) => b.private)
  return [...open, ...priv]
}
