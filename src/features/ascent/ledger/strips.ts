/**
 * WHERE WE STAND — the week, the month and the season each get the strip the
 * year has: its parts laid out, the ones behind you filled, now marked, the
 * rest dashed, and one plain line saying when this chapter closes.
 *
 * The close is a DATE, never a countdown ("closes Sunday, Sep 27", not "6 days
 * left"): it answers "where are we" without turning the calendar into a timer.
 */

import { MONTH_LONG, MONTH_SHORT } from './copy'
import type { Season } from './seasons'

export interface StripCell {
  key: string
  /** Shown under the cell; empty to keep a dense strip readable. */
  label: string
}

export interface Strip {
  cells: StripCell[]
  /** Index of now; -1 before the span, cells.length once it has closed. */
  nowIx: number
  /** 0–1 of the now cell already lived (only meaningful for a coarse cell). */
  nowFill: number
  /** The one line under the strip. */
  note: string
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => {
  const d = utc(s)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
/** "Sep 27". */
export const shortDate = (s: string) => `${MONTH_SHORT[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`
const ordinal = (n: number) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

/** Monday of the ISO week holding `day` — the week the weekly rollup uses. */
export function weekStart(day: string): string {
  const back = (utc(day).getUTCDay() + 6) % 7
  return addDays(day, -back)
}

/** "Sep 21 – 27", or "Sep 29 – Oct 5" across a month. */
export function weekLabel(day: string): string {
  const from = weekStart(day)
  const to = addDays(from, 6)
  return from.slice(5, 7) === to.slice(5, 7) ? `${shortDate(from)} – ${+to.slice(8, 10)}` : `${shortDate(from)} – ${shortDate(to)}`
}

export function weekStrip(today: string): Strip {
  const from = weekStart(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const nowIx = days.indexOf(today)
  const sunday = days[6]!
  return {
    cells: days.map((d, i) => ({ key: d, label: WEEKDAY_SHORT[i]! })),
    nowIx,
    nowFill: 0.5,
    note: `It’s ${WEEKDAY_LONG[nowIx]}. This week is still being written — it closes Sunday, ${shortDate(sunday)}.`,
  }
}

function daysInMonth(ym: string): number {
  return new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()
}

export function monthStrip(ym: string, today: string): Strip {
  const n = daysInMonth(ym)
  const name = MONTH_LONG[+ym.slice(5, 7) - 1]!
  const days = Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
  const last = days[n - 1]!
  const nowIx = today > last ? n : today < days[0]! ? -1 : days.indexOf(today)
  const labelled = new Set([1, 8, 15, 22, n])
  const cells = days.map((d, i) => ({ key: d, label: labelled.has(i + 1) ? String(i + 1) : '' }))
  const note =
    nowIx >= n
      ? `${name} closed on the ${ordinal(n)}.`
      : `It’s the ${ordinal(nowIx + 1)}. ${name} is still being written — it closes on the ${ordinal(n)}.`
  return { cells, nowIx, nowFill: 0.5, note }
}

export function seasonStrip(season: Season, today: string): Strip {
  const months: string[] = []
  let y = +season.from.slice(0, 4)
  let m = +season.from.slice(5, 7)
  for (let i = 0; i < 3; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  const ym = today.slice(0, 7)
  const nowIx = today > season.to ? 3 : today < season.from ? -1 : months.indexOf(ym)
  const nowFill = nowIx >= 0 && nowIx < 3 ? (+today.slice(8, 10) - 0.5) / daysInMonth(ym) : 0
  const name = season.name[0]!.toUpperCase() + season.name.slice(1)
  const ordinalMonth = ['first', 'second', 'last'][nowIx] ?? ''
  const note =
    nowIx >= 3
      ? `${season.label} closed on ${shortDate(season.to)}.`
      : `It’s ${MONTH_LONG[+ym.slice(5, 7) - 1]}, the ${ordinalMonth} month of ${season.name}. ${name} is still being written — it closes ${shortDate(season.to)}.`
  return { cells: months.map((k) => ({ key: k, label: MONTH_SHORT[+k.slice(5, 7) - 1]! })), nowIx, nowFill, note }
}
