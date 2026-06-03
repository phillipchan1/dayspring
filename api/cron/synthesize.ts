// Daily Vercel Cron (vercel.json → "0 8 * * *"). One smart endpoint that decides
// what's due, walking the cascade so each level reads fresh children:
//   • every Monday        → last week's weekly
//   • 1st of the month    → that month's weeklies, then the monthly
//   • 1st of the quarter  → last quarter's monthlies (ensured), then the quarterly
//   • Jan 1               → last year's monthlies (ensured), then the yearly
// Idempotent (builders upsert), so re-running never duplicates.
// Runs for every registered user (from profiles table), not just the app owner.

import { isAuthorized, unauthorized } from '../_lib/auth'
import { supabaseAdmin } from '../_lib/supabaseAdmin'
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
import {
  embedUnembedded,
  threadItems,
  migrateLegacyAnswered,
  sweepOpenThreads,
  harvestPrayers,
} from '../_lib/altar'

async function runForOwner(
  owner: string,
  now: Date,
): Promise<{ results: BuildResult[]; altar: Record<string, unknown>; error?: string }> {
  const results: BuildResult[] = []
  const altar: Record<string, unknown> = {}

  try {
    altar.harvested = await harvestPrayers(owner, { max: 50 })
    altar.embedded = await embedUnembedded(owner)
    altar.threaded = await threadItems(owner)
    altar.migrated = await migrateLegacyAnswered(owner)
    if (isMonday(now)) altar.sweep = await sweepOpenThreads(owner)

    if (isMonday(now)) {
      results.push(await buildWeekly(owner, previousWeek(now)))
    }
    if (isFirstOfMonth(now)) {
      const month = previousMonth(now)
      for (const week of weeksOverlappingMonth(month)) {
        results.push(await buildWeekly(owner, week))
      }
      results.push(await buildMonthly(owner, month))
    }
    if (isFirstOfQuarter(now)) {
      const quarter = previousQuarter(now)
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

    return { results, altar }
  } catch (e) {
    return { results, altar, error: e instanceof Error ? e.message : 'failed' }
  }
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const now = new Date()
  const sb = supabaseAdmin()

  const { data: userRows, error: usersErr } = await sb.from('profiles').select('owner')
  if (usersErr) return Response.json({ error: usersErr.message }, { status: 500 })

  const ownerIds = (userRows ?? []).map((r: { owner: string }) => r.owner)

  const allUsers = await Promise.all(
    ownerIds.map(async (owner) => ({ owner, ...(await runForOwner(owner, now)) })),
  )

  const hasErrors = allUsers.some((u) => u.error)
  return Response.json(
    { ran_at: now.toISOString(), users: allUsers },
    { status: hasErrors ? 207 : 200 },
  )
}
