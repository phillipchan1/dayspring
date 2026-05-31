// Daily Vercel Cron (vercel.json → "0 8 * * *"). One smart endpoint that decides
// what's due: last week's weekly on Mondays, last month's monthly on the 1st.
// Idempotent (builders upsert), so re-running never duplicates.

import { isAuthorized, unauthorized } from '../_lib/auth'
import { env } from '../_lib/env'
import {
  isMonday,
  isFirstOfMonth,
  previousWeek,
  previousMonth,
  weeksOverlappingMonth,
} from '../_lib/dates'
import { buildWeekly, buildMonthly, type BuildResult } from '../_lib/synthesize'

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
  } catch (e) {
    return Response.json(
      { ran_at: now.toISOString(), error: e instanceof Error ? e.message : 'failed', results },
      { status: 500 },
    )
  }

  return Response.json({ ran_at: now.toISOString(), did_work: results.length > 0, results })
}
