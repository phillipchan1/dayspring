import { periodWindow, type Grain, type Span as Period } from '@/lib/period'
import { spanFrom, type Span } from './band'

/**
 * PAGES' WHEN — the room's time control, read off the band.
 *
 * The band is the picture of time on this surface: drag it and you bracket any
 * run of months. The When names the brackets a calendar would — a month, a
 * season, a year — and steps through them, the same control in the same place
 * as on the Ascent, the Lamp and the Altar. It used to be three mono words
 * centred under the band ("month season year"), which nothing else in the app
 * looked like.
 *
 * So there is still one time filter here, the band's bracket, with two ways in:
 * the When sets a bracket a calendar names, a drag sets any other, and the When
 * shows a dragged bracket as the months it covers with no grain lit.
 *
 * No Week: the band's cells are months, and a bracket the timeline cannot show
 * would filter pages the reader cannot see selected.
 */
export const PAGES_SPANS: Period[] = ['month', 'season', 'year', 'all']

type Months = { year: number; month: number }[]

const GRAINS: Grain[] = ['month', 'season', 'year']

/** A month on the band as a moment inside it (mid-month, UTC). */
function at(m: { year: number; month: number }): Date {
  return new Date(Date.UTC(m.year, m.month, 15, 12))
}

/** A period's start as a count of months, for counting periods between two. */
function startIndex(grain: Grain, d: Date): number {
  const w = periodWindow(grain, 0, d)
  return w.from.getUTCFullYear() * 12 + w.from.getUTCMonth()
}

/** How many periods back from `now` the period holding this month is (≥ 0, or −1 if it is ahead). */
export function offsetOf(grain: Grain, m: { year: number; month: number }, now: Date = new Date()): number {
  const months = startIndex(grain, now) - startIndex(grain, at(m))
  const per = grain === 'month' ? 1 : grain === 'season' ? 3 : 12
  return months < 0 ? -1 : Math.round(months / per)
}

/** The band cells a calendar period covers, or null when the archive has none there. */
export function grainSpan(grain: Grain, months: Months, offset = 0, now: Date = new Date()): Span | null {
  const w = periodWindow(grain, offset, now)
  const lo = w.from.getUTCFullYear() * 12 + w.from.getUTCMonth()
  const hi = w.to.getUTCFullYear() * 12 + w.to.getUTCMonth()
  let first = -1
  let last = -1
  months.forEach((m, i) => {
    const n = m.year * 12 + m.month
    if (n >= lo && n <= hi) {
      if (first < 0) first = i
      last = i
    }
  })
  return first < 0 ? null : spanFrom(first, last, months.length)
}

/** How far back the ‹ can go: to the period holding the archive's first month. */
export function maxOffsetFor(grain: Grain, months: Months, now: Date = new Date()): number {
  const first = months[0]
  return first ? Math.max(0, offsetOf(grain, first, now)) : 0
}

/**
 * Which grain and step a bracket is, when a calendar names it. A dragged run of
 * months no calendar names is `span: null` — the When lights no grain for it.
 */
export function whenOf(span: Span | null, months: Months, now: Date = new Date()): { span: Period | null; offset: number } {
  if (!span) return { span: 'all', offset: 0 }
  const start = months[span.from]
  if (!start) return { span: null, offset: 0 }
  for (const grain of GRAINS) {
    const offset = offsetOf(grain, start, now)
    if (offset < 0) continue
    const named = grainSpan(grain, months, offset, now)
    if (named && named.from === span.from && named.to === span.to) return { span: grain, offset }
  }
  return { span: null, offset: 0 }
}

/**
 * The bracket to set when the When steps to `offset`, walking on in the same
 * direction past periods the archive has no months in. Null when there is none.
 */
export function stepTo(
  grain: Grain,
  months: Months,
  offset: number,
  direction: 1 | -1,
  now: Date = new Date(),
): { span: Span; offset: number } | null {
  const max = maxOffsetFor(grain, months, now)
  for (let k = offset; k >= 0 && k <= max; k += direction) {
    const span = grainSpan(grain, months, k, now)
    if (span) return { span, offset: k }
  }
  return null
}
