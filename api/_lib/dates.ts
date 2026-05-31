// Deterministic date math, all in UTC. Periods are stored as `date`
// (YYYY-MM-DD); entries are timestamptz, so range queries use a half-open
// [startOfDay, endOfNextDay) window.

const DAY_MS = 86_400_000

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Midnight UTC at the start of a YYYY-MM-DD date. */
export function dateStrToUTC(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS)
}

export function isMonday(d: Date): boolean {
  return d.getUTCDay() === 1
}

export function isFirstOfMonth(d: Date): boolean {
  return d.getUTCDate() === 1
}

/** The Monday (00:00Z) of the ISO week containing `d`. */
export function mondayOf(d: Date): Date {
  const dow = d.getUTCDay() // 0=Sun..6=Sat
  const back = (dow + 6) % 7 // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return addDays(monday, -back)
}

export interface Period {
  start: string // YYYY-MM-DD inclusive
  end: string // YYYY-MM-DD inclusive
}

/** The previous full Mon–Sun week relative to `now`. */
export function previousWeek(now: Date): Period {
  const thisMonday = mondayOf(now)
  const start = addDays(thisMonday, -7)
  const end = addDays(thisMonday, -1)
  return { start: toDateStr(start), end: toDateStr(end) }
}

/** The previous calendar month relative to `now`. */
export function previousMonth(now: Date): Period {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)) // day 0 = last of prev month
  return { start: toDateStr(start), end: toDateStr(end) }
}

/** Every Mon–Sun week that overlaps a calendar month, for backfilling weeklies. */
export function weeksOverlappingMonth(month: Period): Period[] {
  const monthStart = dateStrToUTC(month.start)
  const monthEnd = dateStrToUTC(month.end)
  const weeks: Period[] = []
  let weekStart = mondayOf(monthStart)
  while (weekStart.getTime() <= monthEnd.getTime()) {
    const weekEnd = addDays(weekStart, 6)
    weeks.push({ start: toDateStr(weekStart), end: toDateStr(weekEnd) })
    weekStart = addDays(weekStart, 7)
  }
  return weeks
}

/** Inclusive count of calendar days between two YYYY-MM-DD dates. */
export function inclusiveDayCount(start: string, end: string): number {
  const diff = dateStrToUTC(end).getTime() - dateStrToUTC(start).getTime()
  return Math.floor(diff / DAY_MS) + 1
}

/** Half-open timestamptz window covering a date period: [start 00:00Z, end+1 00:00Z). */
export function periodWindow(period: Period): { fromISO: string; toExclusiveISO: string } {
  const from = dateStrToUTC(period.start)
  const toExclusive = addDays(dateStrToUTC(period.end), 1)
  return { fromISO: from.toISOString(), toExclusiveISO: toExclusive.toISOString() }
}
