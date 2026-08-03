// The weather grid — years down, months across.
//
// A linear strip answers "when did this happen." Folding time into a grid
// answers a question no notebook can: "does this keep coming back?" You cannot
// lay eleven Novembers side by side on paper at any cost, and that is the whole
// argument for the surface existing.
//
// Everything here is arithmetic. The one sentence the grid produces is a
// template over two integers — no model writes prose about a life (Principle 4),
// and there is nothing to guardrail.
//
// ⚠ This shape is one decision away from a contributions graph, which is a
// streak grid, which is Principle 2. The countermeasure is structural and lives
// at the call site: it is only ever drawn over PASSAGES or over the matches for
// a QUESTION — never over writing activity. It must never be able to answer
// "how faithfully do I journal." No totals, no goal, no current-streak.

export interface Weather {
  /** Ascending. One row per calendar year in the span, gaps included. */
  years: number[]
  /** `cells[yearIndex][month]` — count, 0..n. Month 0 = January. */
  cells: number[][]
  /** The busiest single cell, for scaling. At least 1 so callers can divide. */
  peak: number
  total: number
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const

/** Bucket ISO timestamps into a year × month grid. */
export function buildWeather(dates: string[]): Weather {
  const stamps = dates
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
  if (stamps.length === 0) return { years: [], cells: [], peak: 1, total: 0 }

  // UTC throughout: an entry written at 11pm on 31 December must not slide into
  // the next year because the reader is in a different timezone.
  const ys = stamps.map((d) => d.getUTCFullYear())
  const first = Math.min(...ys)
  const last = Math.max(...ys)

  const years: number[] = []
  for (let y = first; y <= last; y++) years.push(y)
  const cells = years.map(() => new Array<number>(12).fill(0))

  for (const d of stamps) {
    const row = d.getUTCFullYear() - first
    const col = d.getUTCMonth()
    cells[row]![col] = cells[row]![col]! + 1
  }

  let peak = 0
  for (const row of cells) for (const n of row) if (n > peak) peak = n

  return { years, cells, peak: Math.max(1, peak), total: stamps.length }
}

export interface Fold {
  month: number
  total: number
  /** How many distinct years this month has anything in. */
  years: number
  /** Years in the span — the denominator. */
  ofYears: number
}

/** Collapse one month across every year. This is the thing paper can't do. */
export function foldMonth(w: Weather, month: number): Fold {
  let total = 0
  let years = 0
  for (const row of w.cells) {
    const n = row[month] ?? 0
    if (n > 0) {
      years++
      total += n
    }
  }
  return { month, total, years, ofYears: w.years.length }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * One sentence about a fold. States the count and the spread; says nothing
 * about what it means, and never congratulates or laments.
 */
export function foldCopy(fold: Fold, noun = 'passage'): string {
  const name = MONTHS[fold.month]
  if (fold.total === 0) {
    return fold.ofYears <= 1
      ? `Nothing in ${name}.`
      : `Nothing in any ${name}, in ${fold.ofYears} years.`
  }
  if (fold.ofYears <= 1) {
    return `${name}: ${plural(fold.total, noun, `${noun}s`)}.`
  }
  return `${name}: ${plural(fold.total, noun, `${noun}s`)}, across ${fold.years} of ${fold.ofYears} years.`
}

export interface Facts {
  count: number
  first: string | null
  latest: string | null
  /** Whole months between the two longest-separated adjacent dates. */
  longestSilence: number
}

const monthYear = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * The facts row. Computed here, never by a model — same rule as api/_lib/facts.
 * Deliberately absent: anything per-week, per-goal, or expressed as a rate.
 */
export function buildFacts(dates: string[]): Facts {
  const ms = dates
    .map((d) => Date.parse(d))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
  if (ms.length === 0) return { count: 0, first: null, latest: null, longestSilence: 0 }

  let gap = 0
  for (let i = 1; i < ms.length; i++) {
    const months = (ms[i]! - ms[i - 1]!) / (30.44 * 86_400_000)
    if (months > gap) gap = months
  }

  return {
    count: ms.length,
    first: monthYear(new Date(ms[0]!).toISOString()),
    latest: monthYear(new Date(ms[ms.length - 1]!).toISOString()),
    longestSilence: Math.floor(gap),
  }
}
