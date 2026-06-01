// Daily Vercel Cron (vercel.json → "0 8 * * *"). One smart endpoint that decides
// what's due, walking the cascade so each level reads fresh children:
//   • every Monday        → last week's weekly
//   • 1st of the month    → that month's weeklies, then the monthly
//   • 1st of the quarter  → last quarter's monthlies (ensured), then the quarterly
//   • Jan 1               → last year's monthlies (ensured), then the yearly
// Idempotent (builders upsert), so re-running never duplicates.

import { isAuthorized, unauthorized } from '../_lib/auth'
import { env } from '../_lib/env'
import {
  isMonday,
  isFirstOfMonth,
  isFirstOfQuarter,
  isFirstOfYear,
  previousWeek,
  previousMonth,
  previousQuarter,
  previousYear,
  weeksOverlappingMonth,
  monthsInPeriod,
} from '../_lib/dates'
import {
  buildWeekly,
  buildMonthly,
  buildQuarterly,
  buildYearly,
  type BuildResult,
} from '../_lib/synthesize'

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const now = new Date()
  const owner = env.appOwnerId()
  const results: BuildResult[] = []

  try {
    if (isMonday(now)) {
      results.push(await buildWeekly(owner, previousWeek(now)))
    }
    if (isFirstOfMonth(now)) {
      const month = previousMonth(now)
      // Ensure the month's weeklies exist before rolling them up.
      for (const week of weeksOverlappingMonth(month)) {
        results.push(await buildWeekly(owner, week))
      }
      results.push(await buildMonthly(owner, month))
    }
    if (isFirstOfQuarter(now)) {
      const quarter = previousQuarter(now)
      // Ensure each month's monthly exists before the retreat reads them.
      for (const month of monthsInPeriod(quarter)) {
        results.push(await buildMonthly(owner, month))
      }
      results.push(await buildQuarterly(owner, quarter))
    }
    if (isFirstOfYear(now)) {
      const year = previousYear(now)
      for (const month of monthsInPeriod(year)) {
        results.push(await buildMonthly(owner, month))
      }
      results.push(await buildYearly(owner, year))
    }
  } catch (e) {
    return Response.json(
      { ran_at: now.toISOString(), error: e instanceof Error ? e.message : 'failed', results },
      { status: 500 },
    )
  }

  return Response.json({ ran_at: now.toISOString(), did_work: results.length > 0, results })
}
