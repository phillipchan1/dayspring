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
import type { Excerpt, Quote, Rollup } from '@/lib/insights'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'
import type { WordMoment, WordsData } from './types'

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
  if (moments.length === 0) return null
  return { resolution: 'week', periodLabel: periodLabel(weekly), moments }
}

/** HILLSIDE — the lines you kept, from the latest monthly rollup. */
export function monthWords(monthly: Rollup | undefined): WordsData | null {
  if (!monthly) return null
  const moments = keptLines(monthly).slice(0, 6)
  if (moments.length === 0) return null
  return { resolution: 'month', periodLabel: periodLabel(monthly), moments }
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
  if (moments.length === 0) return null
  return { resolution: 'quarter', periodLabel: `Q${q + 1} ${y}`, moments: moments.slice(0, 4) }
}

/** SUMMIT — the one line of the year (the yearly refrain), verbatim. */
export function yearWords(yearly: Rollup | undefined): WordsData | null {
  const refrain = yearly?.payload.reflection?.refrain
  if (!refrain) return null
  return {
    resolution: 'year',
    periodLabel: String(yearOf(yearly!.period_start)),
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
