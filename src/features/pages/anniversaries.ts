// Echoes — the page from an earlier year that rises into the wall in place.
//
// The one arrangement a notebook physically cannot do: put the same week of a
// different year next to the one you are reading. Paper is bound in one order
// forever; this isn't.
//
// Everything here is a fact computed in code — same week of the calendar, an
// earlier year, the writer's own page shown whole. Nothing is selected for
// significance, because which of your weeks mattered is not ours to decide
// (D-016). The model is not involved at any point.

import type { Entry } from '@/lib/types'

/** A page from an earlier year, and the page it rises beside. */
export interface Anniversary {
  /** The page on the wall this one appears after. */
  anchorId: string
  entry: Entry
  yearsAgo: number
  /** True when it is the same calendar day, not merely the same week. */
  sameDay: boolean
}

/** How far either side of the anchor's date still counts as "the same week". */
const WINDOW_DAYS = 3

/**
 * Default minimum pages between two echoes.
 *
 * The caller should scale this to the wall's column count — a gap measured in
 * pages is a gap of one and a half ROWS at eight columns, which put two echoes
 * on screen at once. More often than one and they stop being a surprise and
 * start being a feature you scroll past, which is how a quiet thing turns into
 * noise.
 */
const DEFAULT_MIN_GAP = 12

/**
 * The anchor's month must hold at least this many pages.
 *
 * Don't interleave into a thin stretch. An echo beside a month with one entry
 * reads as a comment on the emptiness — "look what you used to write" — which is
 * a verdict, and the opposite of what this is for.
 */
const MIN_MONTH_DENSITY = 2

function localDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

/** Distance around the calendar ring, so late December and early January are near. */
function ringDistance(a: number, b: number): number {
  const raw = Math.abs(a - b)
  return Math.min(raw, 366 - raw)
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`
}

interface Dated {
  entry: Entry
  date: Date
  year: number
  doy: number
  /** month*100 + date. Leap-proof, unlike day-of-year. */
  md: number
}

/**
 * Find the echoes for a wall.
 *
 * @param ordered  Entries in the order the wall will render them.
 * @param corpus   Everything available to draw an echo from (usually the same list).
 * @param minGap   Pages between echoes. Pass roughly a screenful for the current
 *                 density — see DEFAULT_MIN_GAP.
 *
 * Returns at most one echo per anchor, spaced out, with no entry used twice —
 * a page that keeps reappearing every few screens stops meaning anything.
 */
export function findAnniversaries(
  ordered: Entry[],
  corpus: Entry[] = ordered,
  minGap: number = DEFAULT_MIN_GAP,
): Anniversary[] {
  if (ordered.length === 0) return []

  const dated: Dated[] = corpus.map((entry) => {
    const date = new Date(entry.created_at)
    return {
      entry,
      date,
      year: date.getFullYear(),
      doy: localDayOfYear(date),
      md: (date.getMonth() + 1) * 100 + date.getDate(),
    }
  })

  // How busy each calendar month is — the thin-stretch guard reads this.
  const perMonth = new Map<string, number>()
  for (const d of dated) {
    const k = monthKey(d.date)
    perMonth.set(k, (perMonth.get(k) ?? 0) + 1)
  }

  const byId = new Map<string, Dated>()
  for (const d of dated) byId.set(d.entry.id, d)

  const used = new Set<string>()
  const out: Anniversary[] = []
  let sinceLast = minGap

  for (const anchor of ordered) {
    sinceLast++
    const a = byId.get(anchor.id)
    if (!a) continue
    if (sinceLast < minGap) continue
    if ((perMonth.get(monthKey(a.date)) ?? 0) < MIN_MONTH_DENSITY) continue

    // The most distant year wins. Eleven years back is worth interrupting for;
    // last year is something you probably still remember.
    let best: Dated | null = null
    for (const cand of dated) {
      if (cand.year >= a.year) continue
      if (cand.entry.id === anchor.id || used.has(cand.entry.id)) continue
      if (ringDistance(cand.doy, a.doy) > WINDOW_DAYS) continue
      if (!best || cand.year < best.year) best = cand
    }
    if (!best) continue

    used.add(best.entry.id)
    sinceLast = 0
    out.push({
      anchorId: anchor.id,
      entry: best.entry,
      yearsAgo: a.year - best.year,
      // Compared as month+date, not day-of-year: a leap year shifts every date
      // after February by one, so June 10 and June 10 would read as different days.
      sameDay: best.md === a.md,
    })
  }

  return out
}

const YEAR_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

/**
 * The eyebrow above an echo.
 *
 * Stated flatly, as a fact about the calendar. No "remember this?", no "look how
 * far you've come" — the page is allowed to land on its own.
 */
export function anniversaryLabel(a: Anniversary): string {
  const n = YEAR_WORDS[a.yearsAgo] ?? String(a.yearsAgo)
  const unit = a.yearsAgo === 1 ? 'year' : 'years'
  return `${n} ${unit} earlier · the same ${a.sameDay ? 'day' : 'week'}`
}
