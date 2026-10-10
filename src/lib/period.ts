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
 *    periods nest (weeks inside months inside seasons), which is the only reason
 *    a stone laid in March has an unambiguous place on the year's trail, and the
 *    only reason the yearly rollup can be composed from the year's monthlies.
 *
 *    A season is a NAMED season — winter, spring, summer, fall — the way the
 *    Ascent's told-back climb already said them (`ascent/ledger/seasons.ts`).
 *    It used to be a calendar quarter here, so on October 10 the Altar's
 *    "season" ran Oct–Dec while the Ascent's "Fall 2026" ran Sep–Nov: one word,
 *    two spans, again. Nobody lives in Q4; they live in the fall. The one cost
 *    is that winter straddles New Year, so a season does not always sit inside
 *    one year. The rollup engine's quarter is a different thing and keeps its
 *    own window (`quarterWindow`).
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

/** What a surface can be scoped to: a calendar grain, or everything. */
export type Span = Grain | 'all'

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

/** 0–3, the calendar quarter a month falls in — the rollup engine's tier, not a season. */
export function seasonIndex(monthIndex: number): number {
  return Math.floor(monthIndex / 3)
}

/** The calendar quarter containing `now` — what the quarterly rollup is built on. */
export function quarterWindow(now: Date = new Date()): Required<PeriodWindow> {
  const y = now.getUTCFullYear()
  const q = seasonIndex(now.getUTCMonth())
  return { from: dayStart(y, q * 3, 1), to: dayEnd(y, q * 3 + 3, 0) }
}

/** The month index (−1 = the December before) a named season starts on:
 *  Dec–Feb, Mar–May, Jun–Aug, Sep–Nov. */
function seasonStart(monthIndex: number): number {
  if (monthIndex === 11) return 11
  if (monthIndex <= 1) return -1
  return Math.floor((monthIndex - 2) / 3) * 3 + 2
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
      const start = seasonStart(m)
      return { from: dayStart(y, start, 1), to: dayEnd(y, start + 3, 0) }
    }
    case 'year':
      return { from: dayStart(y, 0, 1), to: dayEnd(y, 11, 31) }
  }
}

/**
 * A grain's window, `offset` periods back from the one containing `now` — the
 * stepper's ‹. Offset 0 is the current period; 1 is last week, last month, last
 * season, last year.
 */
export function periodWindow(grain: Grain, offset = 0, now: Date = new Date()): Required<PeriodWindow> {
  const back = Math.max(0, Math.floor(offset))
  if (back === 0) return grainWindow(grain, now)
  const current = grainWindow(grain, now)
  const y = current.from.getUTCFullYear()
  const m = current.from.getUTCMonth()
  switch (grain) {
    case 'week':
      return grainWindow('week', new Date(current.from.getTime() - back * 7 * DAY_MS))
    case 'month':
      return grainWindow('month', dayStart(y, m - back, 1))
    case 'season':
      return grainWindow('season', dayStart(y, m - back * 3, 1))
    case 'year':
      return grainWindow('year', dayStart(y - back, 0, 1))
  }
}

/** Any span's window at an offset. `all` is unbounded and has no offsets. */
export function spanWindowAt(span: Span, offset = 0, now: Date = new Date()): PeriodWindow {
  if (span === 'all') return {}
  return periodWindow(span, offset, now)
}

/** The window for any span. `all` is unbounded. */
export function spanWindow(span: Span, now: Date = new Date()): PeriodWindow {
  if (span === 'all') return {}
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

const SEASON_NAMES: Record<number, string> = { 11: 'Winter', 2: 'Spring', 5: 'Summer', 8: 'Fall' }

/**
 * How a period says its own name, the way a calendar would: "Oct 5 – 11",
 * "October 2026", "Fall 2026", "Winter 2025–26", "2026". Long enough to be
 * unambiguous when it is the only thing on screen, because these labels travel
 * between surfaces — a reader who picked a season on the Altar and crossed to
 * the Lamp needs to see the same months named there.
 */
export function periodName(grain: Grain, offset = 0, now: Date = new Date()): string {
  const w = periodWindow(grain, offset, now)
  const y = w.from.getUTCFullYear()
  switch (grain) {
    case 'week': {
      const sameMonth = w.from.getUTCMonth() === w.to.getUTCMonth()
      const end = sameMonth ? String(w.to.getUTCDate()) : dayLabel(w.to)
      // A week from another year says so; one that only reaches back over New
      // Year ("Dec 29 – Jan 4") is clear from the months alone.
      const year = w.to.getUTCFullYear() === now.getUTCFullYear() ? '' : `, ${w.from.getUTCFullYear()}`
      return `${dayLabel(w.from)} – ${end}${year}`
    }
    case 'month':
      return `${MONTHS_LONG[w.from.getUTCMonth()]} ${y}`
    case 'season': {
      const name = SEASON_NAMES[w.from.getUTCMonth()]!
      return name === 'Winter' ? `${name} ${y}–${String(y + 1).slice(2)}` : `${name} ${y}`
    }
    case 'year':
      return String(y)
  }
}

/** The current period's name. Kept for callers that only ever mean "this one". */
export function grainLabel(grain: Grain, now: Date = new Date()): string {
  return periodName(grain, 0, now)
}

const GRAIN_WORD: Record<Grain, string> = { week: 'week', month: 'month', season: 'season', year: 'year' }

/**
 * The line above a room's title: which period the room is lit for, in words.
 * "This season · Fall 2026" for the current one, "Season · Summer 2026" for one
 * stepped back to, "All time" for everything. Sentence case — the eyebrow's own
 * CSS sets it in capitals.
 */
export function periodEyebrow(span: Span, offset = 0, now: Date = new Date()): string {
  if (span === 'all') return 'All time'
  const name = periodName(span, offset, now)
  if (offset <= 0) return `This ${GRAIN_WORD[span]} · ${name}`
  const word = GRAIN_WORD[span]
  return `${word[0]!.toUpperCase()}${word.slice(1)} · ${name}`
}

/** The short word a picker shows. Spans say what they are. */
export function spanLabel(span: Span, now: Date = new Date()): string {
  if (span === 'all') return 'all'
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

const VALID: Span[] = ['week', 'month', 'season', 'year', 'all']

function parse(value: string | null): Span | null {
  return VALID.includes(value as Span) ? (value as Span) : null
}

/*
 * How far back the reader has stepped, carried for this session only.
 *
 * Step back to last summer on the Altar, cross to the Lamp, and you are still
 * in last summer — the same promise the grain makes. But it is never written to
 * storage: opening the app next week should open on the present, not on a
 * summer you stopped looking at days ago.
 */
let carriedOffset = 0

/** The offset carried with the period this session (0 = the current one). */
export function readCarriedOffset(): number {
  return carriedOffset
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
export function carryPeriod(span: Span, offset = 0): void {
  try {
    localStorage.setItem(STORAGE_KEY, span)
  } catch {
    // A viewing preference is never worth failing a render over.
  }
  carriedOffset = span === 'all' ? 0 : Math.max(0, Math.floor(offset))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { span, offset: carriedOffset } }))
}

/** Subscribe to the carried period. Returns the unsubscribe. */
export function onCarriedPeriod(fn: (span: Span, offset: number) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ span: Span; offset: number }>).detail
    if (detail && VALID.includes(detail.span)) fn(detail.span, detail.offset ?? 0)
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
