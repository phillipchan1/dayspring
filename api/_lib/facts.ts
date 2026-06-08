// Facts are COMPUTED IN CODE — never by the model. This is the no-hallucination
// surface: deterministic counts derived straight from the entry rows.

import type { Facts } from './types.js'
import { inclusiveDayCount } from './dates.js'

export interface FactEntry {
  created_at: string // ISO timestamp
  word_count: number
}

/** Longest run of consecutive calendar days present in a set of day-strings. */
function longestStreak(days: Set<string>): number {
  if (days.size === 0) return 0
  const sorted = [...days].sort()
  const DAY_MS = 86_400_000
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00.000Z`).getTime()
    const cur = new Date(`${sorted[i]}T00:00:00.000Z`).getTime()
    if (cur - prev === DAY_MS) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }
  return longest
}

/**
 * Compute the "by the numbers" facts for a period.
 * @param weeksReflected number of weekly insights in range (monthly), or null (weekly).
 */
export function computeFacts(
  entries: FactEntry[],
  periodStart: string,
  periodEnd: string,
  weeksReflected: number | null,
): Facts {
  const days = new Set<string>()
  let words = 0
  for (const e of entries) {
    words += e.word_count || 0
    days.add(e.created_at.slice(0, 10))
  }
  return {
    days_written: days.size,
    days_in_period: inclusiveDayCount(periodStart, periodEnd),
    words,
    longest_streak: longestStreak(days),
    weeks_reflected: weeksReflected,
  }
}
