// The band — a subject's months, and how warm each one was.
//
// ── THE BAND HAS NO VERTICAL AXIS, and that is the whole design ─────────────
//
// A bar chart of mentions-per-month has a Y axis, and a falling one under a
// subject called "Mom" reads as *you care less about your mother now* — a
// verdict on a relationship rendered by a machine (Principle 1). So every cell
// is the SAME SIZE and only its warmth changes. There is nothing to be tall or
// short, nothing to trend, nothing to be down on.
//
// Warmth is not a score either. It is a share of this subject's own busiest
// month, so the band says "this month was busier than that one for this
// subject" and nothing whatsoever about whether that is good.
//
// Several subjects give ONE BAND EACH, against the same months. Where they
// overlap is visible without anybody computing an overlap, and where one is
// loud while the other is silent is visible too.

import type { Entry } from '@/lib/types'

export interface BandCell {
  year: number
  /** 0–11. */
  month: number
  /** Pages this subject has in this month. */
  pages: number
  /**
   * 0–1, as a share of this subject's own busiest month.
   *
   * Never across subjects: normalising a quiet subject against a loud one
   * would render "you write about her less than him", which is a comparison
   * nobody asked for and the app has no business making.
   */
  warmth: number
}

export interface Band {
  key: string
  label: string
  cells: BandCell[]
  /** Pages carrying this subject at all. */
  pages: number
  /** Its own first and last page, as ISO dates. */
  first: string | null
  last: string | null
}

const monthKey = (y: number, m: number): string => `${y}-${m}`

/**
 * Every month from the first page in the archive to the last.
 *
 * The SPAN OF THE ARCHIVE, not of the subject — a band that starts where its
 * subject starts hides the years before you had anything to say about them,
 * and those years are the point of comparison.
 */
export function monthsAcross(entries: Entry[]): { year: number; month: number }[] {
  if (entries.length === 0) return []
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const e of entries) {
    const t = new Date(e.created_at)
    const n = t.getFullYear() * 12 + t.getMonth()
    if (n < min) min = n
    if (n > max) max = n
  }
  const out: { year: number; month: number }[] = []
  for (let n = min; n <= max; n++) out.push({ year: Math.floor(n / 12), month: n % 12 })
  return out
}

/**
 * One band, over a fixed set of months.
 *
 * `months` is supplied rather than derived so several subjects share one
 * timeline — which is the only way two bands can be read against each other.
 */
export function bandFor(
  key: string,
  label: string,
  lit: Entry[],
  months: { year: number; month: number }[],
): Band {
  const counts = new Map<string, number>()
  let first: string | null = null
  let last: string | null = null

  for (const e of lit) {
    const t = new Date(e.created_at)
    const k = monthKey(t.getFullYear(), t.getMonth())
    counts.set(k, (counts.get(k) ?? 0) + 1)
    if (first === null || e.created_at < first) first = e.created_at
    if (last === null || e.created_at > last) last = e.created_at
  }

  const busiest = Math.max(1, ...counts.values())
  const cells: BandCell[] = months.map(({ year, month }) => {
    const pages = counts.get(monthKey(year, month)) ?? 0
    return { year, month, pages, warmth: pages === 0 ? 0 : pages / busiest }
  })

  return { key, label, cells, pages: lit.length, first, last }
}

/** "August 2019" — what a cell says when you rest on it. */
export function cellLabel(cell: BandCell, subject: string): string {
  const month = new Date(cell.year, cell.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  if (cell.pages === 0) return `${month} — nothing about ${subject}`
  return `${month} — ${cell.pages} ${cell.pages === 1 ? 'page' : 'pages'} about ${subject}`
}

/** "2011 – 2026", or a single year when that is all there is. */
export function spanLabel(first: string | null, last: string | null): string {
  if (!first || !last) return ''
  const a = new Date(first).getFullYear()
  const b = new Date(last).getFullYear()
  return a === b ? String(a) : `${a} – ${b}`
}

/** A stretch of the archive, as indices into the shared month list. */
export interface Span {
  /** Inclusive, and always the earlier of the two — see `spanFrom`. */
  from: number
  to: number
}

/** Normalise a brush: a drag runs either way, and a span does not. */
export function spanFrom(a: number, b: number, monthCount: number): Span | null {
  if (monthCount <= 0) return null
  const lo = Math.max(0, Math.min(a, b))
  const hi = Math.min(monthCount - 1, Math.max(a, b))
  if (lo > hi) return null
  // The whole archive is not a bracket — it is the absence of one, and saying
  // so keeps "no span" a single state rather than two that look identical.
  if (lo === 0 && hi === monthCount - 1) return null
  return { from: lo, to: hi }
}

/** True when the page falls inside the bracket. */
export function inSpan(
  iso: string,
  span: Span,
  months: { year: number; month: number }[],
): boolean {
  const start = months[span.from]
  const end = months[span.to]
  if (!start || !end) return true
  const t = new Date(iso)
  const n = t.getFullYear() * 12 + t.getMonth()
  return n >= start.year * 12 + start.month && n <= end.year * 12 + end.month
}

/** "November 2019 – March 2021", or one month when that is all it is. */
export function spanText(span: Span, months: { year: number; month: number }[]): string {
  const start = months[span.from]
  const end = months[span.to]
  if (!start || !end) return ''
  const label = (m: { year: number; month: number }) =>
    new Date(m.year, m.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return span.from === span.to ? label(start) : `${label(start)} – ${label(end)}`
}
