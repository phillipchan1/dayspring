// Daily Vercel Cron (vercel.json → "0 8 * * *"). One smart endpoint that decides
// what's due, walking the cascade so each level reads fresh children:
//   • every Monday        → last week's weekly
//   • 1st of the month    → that month's weeklies, then the monthly
//   • 1st of the quarter  → last quarter's monthlies (ensured), then the quarterly
//   • Jan 1               → last year's monthlies (ensured), then the yearly
// Idempotent (builders upsert), so re-running never duplicates.

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

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const now = new Date()

  // Steady-state heartbeat for every account (the one-time archive catch-up is
  // the processing engine). Profiles is one row per user.
  const sb = supabaseAdmin()
  const { data: owners, error } = await sb.from('profiles').select('owner')
  if (error) {
    return Response.json(
      { ran_at: now.toISOString(), error: error.message },
      { status: 500 },
    )
  }

  const perOwner: Array<{ owner: string; results: BuildResult[]; altar: Record<string, unknown> }> = []
  for (const row of owners ?? []) {
    perOwner.push(await synthesizeOwner(row.owner as string, now))
  }

  const didWork = perOwner.some((o) => o.results.length > 0)
  return Response.json({ ran_at: now.toISOString(), owners: perOwner.length, did_work: didWork, perOwner })
}

async function synthesizeOwner(
  owner: string,
  now: Date,
): Promise<{ owner: string; results: BuildResult[]; altar: Record<string, unknown> }> {
  const results: BuildResult[] = []
  const altar: Record<string, unknown> = {}

  try {
    // Altar — keep the cairns current every day: harvest prayers from any new
    // prose (bounded so the function can't time out — the bulk archive harvest is
    // the local script), then embed + thread, migrate the legacy binary, and
    // (weekly) lay evidence beside open threads. Nano-only; frontier stays
    // reserved for the monthly/yearly rollups.
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
    // One owner's failure must not abort the rest of the heartbeat.
    altar.error = e instanceof Error ? e.message : 'failed'
  }

  return { owner, results, altar }
}
