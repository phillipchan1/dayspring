/**
 * "Your words" — the REAL adapter for the Words dimension. The volume inverts by
 * resolution: the Valley shows the actual entries of the latest week in lived
 * order; higher altitudes show fewer, more distilled VERBATIM lines the user
 * kept, and the Summit shows the single line of the year. The app never
 * paraphrases — every moment links back to its source entry.
 *
 * There is no quarterly rollup tier (and the brief treats one as nonexistent),
 * so the quarter is COMPOSED CLIENT-SIDE from the monthly rollups spanning it.
 */

import { listEntriesInWindow } from '@/lib/entries'
import type { Excerpt, Highlight, Quote, Rollup } from '@/lib/insights'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'
import type { AscentArc, Theme, WordMoment, WordsData } from './types'

// ── date helpers (moved here from the old ascentData/summitData) ───────────────

export function fmtDay(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function periodLabel(r: Rollup): string {
  const start = new Date(`${r.period_start}T00:00:00Z`)
  if (r.type === 'monthly') {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  if (r.type === 'yearly') return String(start.getUTCFullYear())
  return `${fmtDay(r.period_start)} – ${fmtDay(r.period_end)}`
}

/** Inclusive YYYY-MM-DD period → [fromISO, toExclusiveISO) for an entries read. */
function windowOf(periodStart: string, periodEnd: string): [string, string] {
  const fromISO = `${periodStart}T00:00:00.000Z`
  const end = new Date(`${periodEnd}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return [fromISO, end.toISOString()]
}

function quarterOf(periodStart: string): number {
  return Math.floor(new Date(`${periodStart}T00:00:00Z`).getUTCMonth() / 3)
}
function yearOf(periodStart: string): number {
  return new Date(`${periodStart}T00:00:00Z`).getUTCFullYear()
}

// ── excerpt cleanup (Valley body when no verbatim citation exists) ─────────────

const EXCERPT_MAX = 200

export function entryExcerpt(bodyMarkdown: string): string {
  const plain = stripSpiritualBlocks(bodyMarkdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/!\?\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= EXCERPT_MAX) return plain
  const cut = plain.slice(0, EXCERPT_MAX)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  const at = lastStop > 80 ? lastStop + 1 : cut.lastIndexOf(' ')
  return `${cut.slice(0, at > 0 ? at : EXCERPT_MAX).trim()}…`
}

// ── kept-line extraction (verbatim, from a rollup's reflection) ────────────────

/** The verbatim lines the user kept, drawn from a rollup. Prefers the
 *  reflection's validated citations; falls back to the generic quotes. */
function keptLines(r: Rollup): WordMoment[] {
  const src: (Excerpt | Quote)[] =
    r.payload.reflection?.citations?.length ? r.payload.reflection.citations : (r.payload.quotes ?? [])
  const seen = new Set<string>()
  const out: WordMoment[] = []
  for (const x of src) {
    const key = x.text.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ entryId: x.entry_id, dateLabel: fmtDay(x.date), text: x.text, isQuote: true })
  }
  return out
}

// ── themes (the highlight layer — grounded in verbatim quotes) ─────────────────

/** Map a stored Highlight → the Theme view model (quotes sorted along the season). */
function toTheme(h: Highlight): Theme {
  const quotes = h.quotes
    .map((q) => ({ entryId: q.entry_id, date: q.date, dateLabel: fmtDay(q.date), text: q.text }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { id: h.id, label: h.label, quotes }
}

function themesOf(r: Rollup | undefined): Theme[] {
  return (r?.payload.reflection?.highlights ?? []).map(toTheme)
}

// ── arcs (the narrative movements — "what you kept returning to") ──────────────

function arcsOf(r: Rollup | undefined): AscentArc[] {
  return (r?.payload.reflection?.arcs ?? [])
    .filter((a) => a.name && a.note)
    .map((a) => ({ name: a.name, note: a.note }))
}

/** Merge arcs across a quarter's monthlies, deduped by name. */
function composeQuarterArcs(monthlies: Rollup[]): AscentArc[] {
  const byName = new Map<string, AscentArc>()
  for (const m of monthlies) for (const a of arcsOf(m)) if (!byName.has(a.name)) byName.set(a.name, a)
  return [...byName.values()].slice(0, 4)
}

/** RIDGE has no quarterly tier — compose the season's themes by merging the
 *  quarter's monthly highlights by label, concatenating (deduped) their quotes. */
function composeQuarterThemes(monthlies: Rollup[]): Theme[] {
  const byLabel = new Map<string, Theme>()
  for (const m of monthlies) {
    for (const t of themesOf(m)) {
      const key = t.label.trim().toLowerCase()
      const existing = byLabel.get(key)
      if (!existing) {
        byLabel.set(key, { ...t, quotes: [...t.quotes] })
        continue
      }
      const seen = new Set(existing.quotes.map((q) => q.text))
      for (const q of t.quotes) if (!seen.has(q.text)) existing.quotes.push(q)
    }
  }
  return [...byLabel.values()]
    .map((t) => ({ ...t, quotes: t.quotes.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4) }))
    .slice(0, 3)
}

// ── loaders (rollups are passed in by the seam to avoid duplicate reads) ───────

/** Shortest a non-cited entry can be before it reads as noise, not a day. Cited
 *  lines (the synthesis's kept highlights) are always shown, however short. */
const MIN_VALLEY_CHARS = 16

/**
 * VALLEY — the entries of the latest week, oldest-first. The app only ARRANGES,
 * but arranging ≠ dumping: it leads with the verbatim lines the weekly synthesis
 * kept (the highlights, shown as quotes), and skips literal noise — empty bodies,
 * sub-threshold fragments, and exact duplicates — so the signal isn't buried.
 * Order is preserved; nothing is ranked or interpreted.
 */
export async function loadWeekWords(weekly: Rollup | undefined): Promise<WordsData | null> {
  if (!weekly) return null
  const [fromISO, toISO] = windowOf(weekly.period_start, weekly.period_end)
  const entries = await listEntriesInWindow(fromISO, toISO)
  if (entries.length === 0) return null

  const citations = new Map<string, string>()
  for (const c of weekly.payload.reflection?.citations ?? []) {
    if (!citations.has(c.entry_id)) citations.set(c.entry_id, c.text)
  }

  const seen = new Set<string>()
  const moments: WordMoment[] = []
  for (const e of entries) {
    const quote = citations.get(e.id)
    const text = quote ?? entryExcerpt(e.body_markdown)
    const norm = text.trim().toLowerCase()
    // A kept line always stands; otherwise drop blanks/fragments and exact dupes.
    if (!quote && norm.length < MIN_VALLEY_CHARS) continue
    if (seen.has(norm)) continue
    seen.add(norm)
    moments.push({
      entryId: e.id,
      dateLabel: fmtDay(e.created_at),
      text,
      isQuote: quote !== undefined,
    })
  }
  const themes = themesOf(weekly)
  const arcs = arcsOf(weekly)
  if (moments.length === 0 && themes.length === 0 && arcs.length === 0) return null
  return { resolution: 'week', periodLabel: periodLabel(weekly), arcs, themes, moments }
}

/** HILLSIDE — the month's themes (grounded), with the kept lines as fallback. */
export function monthWords(monthly: Rollup | undefined): WordsData | null {
  if (!monthly) return null
  const themes = themesOf(monthly)
  const arcs = arcsOf(monthly)
  const moments = keptLines(monthly).slice(0, 6)
  if (moments.length === 0 && themes.length === 0 && arcs.length === 0) return null
  return { resolution: 'month', periodLabel: periodLabel(monthly), arcs, themes, moments }
}

/** RIDGE — the phrases you circled, composed from the monthly rollups spanning
 *  the latest quarter (there is no quarterly tier). Fewer, more distilled. */
export function quarterWords(monthlies: Rollup[]): WordsData | null {
  const latest = monthlies[0]
  if (!latest) return null
  const y = yearOf(latest.period_start)
  const q = quarterOf(latest.period_start)
  const inQuarter = monthlies.filter(
    (m) => yearOf(m.period_start) === y && quarterOf(m.period_start) === q,
  )
  const seen = new Set<string>()
  const moments: WordMoment[] = []
  for (const m of inQuarter) {
    for (const line of keptLines(m)) {
      if (seen.has(line.text)) continue
      seen.add(line.text)
      moments.push(line)
    }
  }
  const themes = composeQuarterThemes(inQuarter)
  const arcs = composeQuarterArcs(inQuarter)
  if (moments.length === 0 && themes.length === 0 && arcs.length === 0) return null
  return {
    resolution: 'quarter',
    periodLabel: `Q${q + 1} ${y}`,
    arcs,
    themes,
    moments: moments.slice(0, 4),
  }
}

/** SUMMIT — the one line of the year (the yearly refrain), verbatim. */
export function yearWords(yearly: Rollup | undefined): WordsData | null {
  const refrain = yearly?.payload.reflection?.refrain
  const arcs = arcsOf(yearly)
  if (!refrain && arcs.length === 0) return null
  if (!refrain) {
    return { resolution: 'year', periodLabel: String(yearOf(yearly!.period_start)), arcs, themes: [], moments: [] }
  }
  return {
    resolution: 'year',
    periodLabel: String(yearOf(yearly!.period_start)),
    arcs,
    themes: [],
    moments: [
      {
        entryId: refrain.entry_id,
        dateLabel: fmtDay(refrain.date),
        text: refrain.text,
        isQuote: true,
      },
    ],
  }
}
