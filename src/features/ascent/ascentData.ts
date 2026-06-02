/**
 * The Ascent's read side for the three lower altitudes (Valley / Hillside /
 * Ridge). Each altitude reads ITS OWN rollup tier — never re-summarizes raw
 * entries — except the Valley, which by design shows the actual entries of the
 * latest week, in lived order. The Summit's cross-surface aggregation lives in
 * `summit.ts`.
 *
 * Mapping rules mirror the differentiation gradient:
 *   Valley   — real entries, verbatim where a weekly citation exists.
 *   Hillside — `reflection.arcs` (graceful fallback to `topics`).
 *   Ridge    — `reflection.tensions` (graceful fallback to `questions`).
 */

import { listEntriesInWindow } from '@/lib/entries'
import { listRollups, type Arc, type Rollup, type Tension } from '@/lib/insights'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'

// ── shapes the altitude components render ────────────────────────────────────

export interface ValleyEntry {
  id: string
  dateLabel: string
  text: string
  /** A verbatim weekly citation from this entry — rendered as a quote. */
  isQuote: boolean
}
export interface ValleyData {
  periodLabel: string
  entries: ValleyEntry[]
}

export interface HillsideData {
  /** The monthly rollup id — the target for arc edits. */
  rollupId: string
  periodLabel: string
  arcs: Arc[]
  /** True when arcs were derived from legacy topics (note may be empty). */
  fromTopics: boolean
}

export interface RidgeData {
  periodLabel: string
  tensions: Tension[]
}

// ── date helpers ──────────────────────────────────────────────────────────────

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function periodLabel(r: Rollup): string {
  const start = new Date(`${r.period_start}T00:00:00Z`)
  if (r.type === 'monthly') {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  if (r.type === 'yearly') return String(start.getUTCFullYear())
  if (r.type === 'quarterly') {
    return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`
  }
  return `${fmtDay(r.period_start)} – ${fmtDay(r.period_end)}`
}

/** Inclusive YYYY-MM-DD period → [fromISO, toExclusiveISO) for an entries read. */
function windowOf(periodStart: string, periodEnd: string): [string, string] {
  const fromISO = `${periodStart}T00:00:00.000Z`
  const end = new Date(`${periodEnd}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return [fromISO, end.toISOString()]
}

// ── excerpt cleanup (Valley body when no verbatim citation exists) ────────────

const EXCERPT_MAX = 220

/** A clean, plain reading of an entry body for the Valley card. */
export function entryExcerpt(bodyMarkdown: string): string {
  const plain = stripSpiritualBlocks(bodyMarkdown)
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^>\s?/gm, '') // blockquotes
    .replace(/[*_`~]/g, '') // emphasis / code marks
    .replace(/!\?\[[^\]]*\]\([^)]*\)/g, '') // stray images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= EXCERPT_MAX) return plain
  const cut = plain.slice(0, EXCERPT_MAX)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  const at = lastStop > 80 ? lastStop + 1 : cut.lastIndexOf(' ')
  return `${cut.slice(0, at > 0 ? at : EXCERPT_MAX).trim()}…`
}

// ── loaders ──────────────────────────────────────────────────────────────────

/**
 * VALLEY — the actual entries of the latest weekly period, oldest-first. Where a
 * weekly citation exists for an entry, its verbatim line is shown (italicised);
 * otherwise a clean excerpt. Returns null when there are no entries at all.
 */
export async function loadValley(): Promise<ValleyData | null> {
  const weeklies = await listRollups('weekly')
  const latest = weeklies[0]
  if (!latest) return null

  const [fromISO, toISO] = windowOf(latest.period_start, latest.period_end)
  const entries = await listEntriesInWindow(fromISO, toISO)
  if (entries.length === 0) return null

  // entry_id → first verbatim citation text (the verbatim principle, surfaced).
  const citations = new Map<string, string>()
  for (const c of latest.payload.reflection?.citations ?? []) {
    if (!citations.has(c.entry_id)) citations.set(c.entry_id, c.text)
  }

  const mapped: ValleyEntry[] = entries.map((e) => {
    const quote = citations.get(e.id)
    return {
      id: e.id,
      dateLabel: fmtDay(e.created_at.slice(0, 10)),
      text: quote ?? entryExcerpt(e.body_markdown),
      isQuote: quote !== undefined,
    }
  })

  return { periodLabel: periodLabel(latest), entries: mapped }
}

/** Capitalise a topic label used as a fallback arc name. */
function titleCase(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
}

/**
 * HILLSIDE — named arcs from the latest monthly rollup. Falls back to deriving
 * arcs from `topics` (count → weight) on legacy rows that predate arc
 * generation, so the surface is never empty when a month has been synthesized.
 */
export async function loadHillside(): Promise<HillsideData | null> {
  const monthlies = await listRollups('monthly')
  const latest = monthlies[0]
  if (!latest) return null

  const rc = latest.payload.reflection
  const arcs = rc?.arcs ?? []
  if (arcs.length > 0) {
    return { rollupId: latest.id, periodLabel: periodLabel(latest), arcs, fromTopics: false }
  }

  // Fallback: synthesize arcs from topics so legacy months still read.
  const topics = latest.payload.topics ?? []
  const fromTopics: Arc[] = topics
    .filter((t) => t.entry_ids.length > 0)
    .slice(0, 5)
    .map((t, i) => ({
      id: `topic-${i}`,
      name: titleCase(t.label),
      note: '',
      weight: t.count,
      entry_ids: t.entry_ids,
    }))
  if (fromTopics.length === 0) return null
  return { rollupId: latest.id, periodLabel: periodLabel(latest), arcs: fromTopics, fromTopics: true }
}

/**
 * RIDGE — open tensions from the latest quarterly rollup, handed back as
 * questions. Falls back to mapping the quarterly `questions` (no thread label)
 * on legacy rows. Never resolves a tension — the question is the whole point.
 */
export async function loadRidge(): Promise<RidgeData | null> {
  const quarterlies = await listRollups('quarterly')
  const latest = quarterlies[0]
  if (!latest) return null

  const rc = latest.payload.reflection
  const tensions = rc?.tensions ?? []
  if (tensions.length > 0) {
    return { periodLabel: periodLabel(latest), tensions }
  }

  const fallback: Tension[] = (rc?.questions ?? []).slice(0, 3).map((q, i) => ({
    id: `q-${i}`,
    thread: '',
    question: q.text,
  }))
  if (fallback.length === 0) return null
  return { periodLabel: periodLabel(latest), tensions: fallback }
}
