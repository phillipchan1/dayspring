/**
 * THE ONE CALENDAR — the shared time vocabulary for every Remember surface.
 *
 * Before this module the four surfaces each invented their own arithmetic, and
 * the same word named a different span on each: the Ascent's "quarter" was a
 * calendar quarter, the Altar's "season" was the trailing 91 days, the Lamp's
 * was the trailing 90. A reader crossing between them saw three different sets
 * of entries under one label with no way to know why.
 *
 * Two rules settle it:
 *
 * 1. **Calendar, never trailing.** A trailing window cannot be named, shared or
 *    nested — nobody remembers what happened in "the last 91 days". Calendar
 *    periods nest exactly (52 weeks inside 12 months inside 4 seasons inside a
 *    year), which is the only reason a stone laid in March has an unambiguous
 *    place on the year's trail, and the only reason the yearly rollup can be
 *    composed from the year's monthlies.
 *
 * 2. **UTC day boundaries.** The rollup engine already stores periods as UTC
 *    `date` strings (`api/_lib/dates.ts`), so the surfaces match it rather than
 *    the reader's timezone. A window built here and a period built there name
 *    the same days.
 *
 * The current period always runs to the END of its calendar span, not to today.
 * A query over a window whose tail hasn't happened yet simply finds nothing
 * there, and keeping the full span means the window is a stable cache key for
 * the whole period instead of a new one every midnight.
 */

const DAY_MS = 86_400_000

/** The four nesting grains — the spine of every Remember surface. */
export type Grain = 'week' | 'month' | 'season' | 'year'

/** What a surface can be scoped to. The long spans are the Altar's: they are
 *  honestly spans and not calendar periods, so they are named as spans. */
export type Span = Grain | '5y' | '10y' | 'all'

export const GRAINS: Grain[] = ['week', 'month', 'season', 'year']

export function isGrain(span: Span): span is Grain {
  return span === 'week' || span === 'month' || span === 'season' || span === 'year'
}

/** `from`/`to` absent = unbounded (the all-time field). */
export interface PeriodWindow {
  from?: Date
  to?: Date
}

function dayStart(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
}
function dayEnd(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999))
}

/** The Monday (00:00Z) of the ISO week containing `d` — the same week boundary
 *  the weekly rollup is built on, so the Valley and its synthesis agree. */
export function mondayOf(d: Date): Date {
  const back = (d.getUTCDay() + 6) % 7 // days since Monday (Sunday = 6)
  return new Date(dayStart(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime() - back * DAY_MS)
}

/** 0–3. A season is a calendar quarter; "season" is what we call it out loud. */
export function seasonIndex(monthIndex: number): number {
  return Math.floor(monthIndex / 3)
}

/** The calendar window for a grain, containing `now`. */
export function grainWindow(grain: Grain, now: Date = new Date()): Required<PeriodWindow> {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  switch (grain) {
    case 'week': {
      const monday = mondayOf(now)
      const sunday = new Date(monday.getTime() + 6 * DAY_MS)
      return {
        from: monday,
        to: dayEnd(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()),
      }
    }
    case 'month':
      return { from: dayStart(y, m, 1), to: dayEnd(y, m + 1, 0) }
    case 'season': {
      const q = seasonIndex(m)
      return { from: dayStart(y, q * 3, 1), to: dayEnd(y, q * 3 + 3, 0) }
    }
    case 'year':
      return { from: dayStart(y, 0, 1), to: dayEnd(y, 11, 31) }
  }
}

/** The window for any span, including the Altar's long ones. `all` is unbounded.
 *  The long spans are anchored to the START of the calendar year N years back,
 *  not to a rolling millisecond count, so "5 years" means five whole years. */
export function spanWindow(span: Span, now: Date = new Date()): PeriodWindow {
  if (span === 'all') return {}
  if (span === '5y' || span === '10y') {
    const back = span === '5y' ? 5 : 10
    const y = now.getUTCFullYear()
    return { from: dayStart(y - back + 1, 0, 1), to: dayEnd(y, 11, 31) }
  }
  return grainWindow(span, now)
}

/** Millisecond floor of a span, for callers that compare timestamps directly.
 *  `-Infinity` is the all-time field. */
export function spanStartMs(span: Span, now: Date = new Date()): number {
  const w = spanWindow(span, now)
  return w.from ? w.from.getTime() : -Infinity
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function dayLabel(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/**
 * How a period says its own name. Long enough to be unambiguous when it is the
 * only thing on screen, because these labels travel between surfaces — a reader
 * who picked "season" on the Altar and crossed to the Lamp needs to see the same
 * months named there.
 */
export function grainLabel(grain: Grain, now: Date = new Date()): string {
  const w = grainWindow(grain, now)
  const y = w.from.getUTCFullYear()
  switch (grain) {
    case 'week':
      return `${dayLabel(w.from)} – ${dayLabel(w.to)}`
    case 'month':
      return `${MONTHS_LONG[w.from.getUTCMonth()]} ${y}`
    case 'season':
      return `${MONTHS_SHORT[w.from.getUTCMonth()]} – ${MONTHS_SHORT[w.to.getUTCMonth()]} ${y}`
    case 'year':
      return String(y)
  }
}

/** The short word a picker shows. Spans say what they are. */
export function spanLabel(span: Span, now: Date = new Date()): string {
  if (span === 'all') return 'all'
  if (span === '5y') return '5 years'
  if (span === '10y') return '10 years'
  if (span === 'week') return 'week'
  if (span === 'month') return 'month'
  if (span === 'season') return 'season'
  void now
  return 'year'
}

// ── the carried selection ────────────────────────────────────────────────────
// One period, picked once. Choose a season on the Altar, cross to the Lamp, and
// you are still in it — that is the whole of what makes four surfaces read as a
// system instead of four tools. Per-device by design: this is a viewing
// preference, not content, and it must never cost a network read on arrival.

const STORAGE_KEY = 'dayspring:remember-period'
const EVENT = 'dayspring:remember-period'

const VALID: Span[] = ['week', 'month', 'season', 'year', '5y', '10y', 'all']

function parse(value: string | null): Span | null {
  return VALID.includes(value as Span) ? (value as Span) : null
}

/** The carried period, or `fallback` when nothing has been picked (or storage
 *  is unavailable — a private window, blocked site data, a preview harness). */
export function readCarriedPeriod(fallback: Span = 'year'): Span {
  try {
    return parse(localStorage.getItem(STORAGE_KEY)) ?? fallback
  } catch {
    return fallback
  }
}

/** Carry a period to the other surfaces. Broadcasts in-tab (the `storage` event
 *  only fires in OTHER tabs, which is exactly the case we don't have). */
export function carryPeriod(span: Span): void {
  try {
    localStorage.setItem(STORAGE_KEY, span)
  } catch {
    // A viewing preference is never worth failing a render over.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: span }))
}

/** Subscribe to the carried period. Returns the unsubscribe. */
export function onCarriedPeriod(fn: (span: Span) => void): () => void {
  const handler = (e: Event) => {
    const span = (e as CustomEvent<Span>).detail
    if (span && VALID.includes(span)) fn(span)
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
