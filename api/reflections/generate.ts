// Manual trigger so a rollup can be generated on demand (e.g. backfilling May
// before the cron ever fires). Same Bearer guard as the cron.
//   POST /api/reflections/generate
//   Authorization: Bearer ${CRON_SECRET}
//   { "type": "weekly" | "monthly", "start": "2026-05-01", "end": "2026-05-31" }

import { isAuthorized, unauthorized } from '../_lib/auth'
import { env } from '../_lib/env'
import { buildWeekly, buildMonthly } from '../_lib/synthesize'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  let body: { type?: string; start?: string; end?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { type, start, end } = body
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return Response.json({ error: 'start and end (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (type !== 'weekly' && type !== 'monthly') {
    return Response.json({ error: "type must be 'weekly' or 'monthly'" }, { status: 400 })
  }

  const owner = env.appOwnerId()
  const period = { start, end }

  try {
    const result = type === 'weekly'
      ? await buildWeekly(owner, period)
      : await buildMonthly(owner, period)
    return Response.json(result)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
