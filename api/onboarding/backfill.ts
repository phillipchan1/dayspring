// POST /api/onboarding/backfill
// The one-time historical rollup, triggered once at the end of an import. Reuses
// the existing compounding builders (buildWeekly → buildMonthly); it does NOT
// reimplement synthesis. User-authed (the authenticated user is the owner), so
// it works for any account — unlike the cron, which is single-owner.
//
// Two scopes:
//  • 'recent' (default): build the most-recent complete month (its weeklies, then
//    the monthly) synchronously and return the period. This powers the onboarding
//    Reveal — the user's most recent month-in-review, generated on demand.
//  • 'full': walk the rest of history oldest → newest within a time budget,
//    building each month's weeklies then its monthly. Resumable: returns
//    { done, nextCursor } so the client can drive the remainder in the
//    background (Vercel functions can't truly detach after responding).
//
// Idempotent — the builders upsert, so re-running never duplicates.
//
// Requires: Authorization: Bearer <supabase-jwt>

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'
import { buildWeekly, buildMonthly, type BuildResult } from '../_lib/synthesize.js'
import { scanConcordance } from '../_lib/concordance.js'
import {
  monthsInPeriod,
  weeksOverlappingMonth,
  periodWindow,
  toDateStr,
  type Period,
} from '../_lib/dates.js'

// Soft wall-clock budget for a single 'full' request. Vercel functions cap out;
// stop well before that and hand the client a cursor to resume from.
const FULL_BUDGET_MS = 45_000

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

/** The calendar month containing a date, as an inclusive YYYY-MM-DD period. */
function monthOf(d: Date): Period {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return { start: toDateStr(start), end: toDateStr(end) }
}

/** The bounding created_at of the owner's entries, or null when there are none. */
async function entrySpan(owner: string): Promise<{ first: Date; last: Date } | null> {
  const sb = supabaseAdmin()
  const [{ data: oldest }, { data: newest }] = await Promise.all([
    sb.from('entries').select('created_at').eq('owner', owner)
      .order('created_at', { ascending: true }).limit(1).maybeSingle(),
    sb.from('entries').select('created_at').eq('owner', owner)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!oldest?.created_at || !newest?.created_at) return null
  return { first: new Date(oldest.created_at), last: new Date(newest.created_at) }
}

async function hasEntries(owner: string, period: Period): Promise<boolean> {
  const sb = supabaseAdmin()
  const { fromISO, toExclusiveISO } = periodWindow(period)
  const { count } = await sb
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('owner', owner)
    .gte('created_at', fromISO)
    .lt('created_at', toExclusiveISO)
  return (count ?? 0) > 0
}

/** Build a month: its overlapping weeklies first, then the monthly rollup. */
async function buildMonth(owner: string, month: Period): Promise<BuildResult[]> {
  const results: BuildResult[] = []
  for (const week of weeksOverlappingMonth(month)) {
    results.push(await buildWeekly(owner, week))
  }
  results.push(await buildMonthly(owner, month))
  return results
}

/** The most-recent complete month that has entries; falls back to the latest
 *  (possibly partial) month so the Reveal always has something real to show. */
function targetMonth(span: { first: Date; last: Date }): Period {
  const latest = monthOf(span.last)
  const now = new Date()
  // If the latest entry's month hasn't fully elapsed, prefer the prior month.
  const latestEnd = new Date(`${latest.end}T00:00:00.000Z`)
  if (latestEnd.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    const prev = monthOf(new Date(Date.UTC(span.last.getUTCFullYear(), span.last.getUTCMonth() - 1, 1)))
    // Use the prior month only if it's still within the user's written span.
    if (new Date(`${prev.start}T00:00:00.000Z`) >= new Date(Date.UTC(span.first.getUTCFullYear(), span.first.getUTCMonth(), 1))) {
      return prev
    }
  }
  return latest
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  let body: { scope?: string; cursor?: string }
  try {
    body = (await req.json().catch(() => ({}))) as typeof body
  } catch {
    body = {}
  }
  const scope = body.scope === 'full' ? 'full' : 'recent'
  const owner = user.id

  const span = await entrySpan(owner)
  if (!span) {
    return withCors(req, Response.json({ status: 'skipped', reason: 'no entries' }))
  }

  try {
    if (scope === 'recent') {
      const month = targetMonth(span)
      // Seed the Concordance over the Reveal's window FIRST — synchronously, so
      // the window is fully seeded before the Reveal job reads (bounded to one
      // month of entries; the rest of the corpus drains via the 'concordance'
      // processing job). Fail open: the Concordance is a fidelity layer, never a
      // dependency — an extraction failure must not delay or block the Reveal.
      try {
        const { fromISO, toExclusiveISO } = periodWindow(month)
        await scanConcordance(owner, { window: { fromISO, toExclusiveISO }, source: 'import' })
      } catch (e) {
        console.warn('concordance reveal-window seed failed', e)
      }
      const results = await buildMonth(owner, month)
      const monthly = results.find((r) => r.type === 'monthly')
      return withCors(
        req,
        Response.json({
          status: monthly?.status ?? 'skipped',
          period_start: month.start,
          period_end: month.end,
          results,
        }),
      )
    }

    // scope === 'full' — walk every month oldest → newest, skipping the recent
    // month already built, within a time budget. Resume via nextCursor.
    const startedAt = Date.now()
    const recent = targetMonth(span)
    const allMonths = monthsInPeriod({ start: monthOf(span.first).start, end: monthOf(span.last).end })

    const cursor = body.cursor && DATE_RE.test(body.cursor) ? body.cursor : null
    let pending = allMonths.filter((m) => m.start !== recent.start)
    if (cursor) pending = pending.filter((m) => m.start >= cursor)

    const built: string[] = []
    let nextCursor: string | null = null
    for (let i = 0; i < pending.length; i++) {
      const month = pending[i]!
      if (Date.now() - startedAt > FULL_BUDGET_MS && i > 0) {
        nextCursor = month.start
        break
      }
      if (await hasEntries(owner, month)) {
        await buildMonth(owner, month)
        built.push(month.start)
      }
    }

    return withCors(
      req,
      Response.json({ status: 'ok', done: nextCursor === null, nextCursor, built }),
    )
  } catch (e) {
    return withCors(
      req,
      Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }),
    )
  }
}
