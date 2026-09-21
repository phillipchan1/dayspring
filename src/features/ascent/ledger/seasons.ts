/**
 * SEASONS, NAMED — spring, summer, fall, winter, as people say them.
 *
 * `src/lib/period.ts` calls a calendar quarter a "season" (Jan–Mar is "season
 * 1"). Nobody lives in Q1; they live in winter. The ledger's Ridge uses real
 * seasons instead: meteorological ones, which is what "Fall 2026" means out
 * loud. Kept here, not in period.ts, while it proves out on alpha — the Altar
 * and Lamp still read the shared quarter calendar.
 *
 * Winter crosses the new year: December 2025 belongs to "Winter 2025–26". In
 * the southern hemisphere the names swap (December is summer).
 */

export type SeasonName = 'winter' | 'spring' | 'summer' | 'fall'
export type Hemisphere = 'north' | 'south'

export interface Season {
  /** Stable key: `${name}-${startYear}`, e.g. `winter-2025` (Dec 2025 – Feb 2026). */
  key: string
  name: SeasonName
  /** The year the season starts in. */
  year: number
  /** YYYY-MM-DD, inclusive. */
  from: string
  /** YYYY-MM-DD, inclusive. */
  to: string
  /** "Fall 2026", "Winter 2025–26". */
  label: string
  /** "September – November". */
  months: string
}

// Month (1–12) → the season that month opens, in the north. The south shifts
// every name by two places.
const NORTH: Record<number, SeasonName> = { 12: 'winter', 3: 'spring', 6: 'summer', 9: 'fall' }
const ORDER: SeasonName[] = ['winter', 'spring', 'summer', 'fall']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function nameFor(startMonth: number, hemi: Hemisphere): SeasonName {
  const north = NORTH[startMonth]!
  if (hemi === 'north') return north
  return ORDER[(ORDER.indexOf(north) + 2) % 4]!
}

function lastDay(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** The season a start month (12, 3, 6 or 9) of a given year opens. */
function build(startYear: number, startMonth: number, hemi: Hemisphere): Season {
  const name = nameFor(startMonth, hemi)
  const endMonth = ((startMonth + 1) % 12) + 1
  const endYear = startMonth === 12 ? startYear + 1 : startYear
  const from = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
  const to = lastDay(endYear, endMonth)
  const cap = name[0]!.toUpperCase() + name.slice(1)
  const label = startMonth === 12 ? `${cap} ${startYear}–${String(startYear + 1).slice(2)}` : `${cap} ${startYear}`
  const months = `${MONTH_NAMES[startMonth - 1]} – ${MONTH_NAMES[endMonth - 1]}`
  return { key: `${name}-${startYear}`, name, year: startYear, from, to, label, months }
}

/** The season a date (YYYY-MM-DD…) falls in. */
export function seasonOf(date: string, hemi: Hemisphere = 'north'): Season {
  const y = +date.slice(0, 4)
  const m = +date.slice(5, 7)
  if (m === 12) return build(y, 12, hemi)
  if (m <= 2) return build(y - 1, 12, hemi)
  if (m <= 5) return build(y, 3, hemi)
  if (m <= 8) return build(y, 6, hemi)
  return build(y, 9, hemi)
}

/** The season before this one. */
export function previousSeason(s: Season, hemi: Hemisphere = 'north'): Season {
  const d = new Date(`${s.from}T00:00:00Z`)
  d.setUTCDate(0) // last day of the month before the season starts
  return seasonOf(d.toISOString().slice(0, 10), hemi)
}

/** The season after this one. */
export function nextSeason(s: Season, hemi: Hemisphere = 'north'): Season {
  const d = new Date(`${s.to}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return seasonOf(d.toISOString().slice(0, 10), hemi)
}

/** Seasons, oldest first, ending with the one `today` is in. */
export function recentSeasons(today: string, count: number, hemi: Hemisphere = 'north'): Season[] {
  const out = [seasonOf(today, hemi)]
  while (out.length < count) out.unshift(previousSeason(out[0]!, hemi))
  return out
}
