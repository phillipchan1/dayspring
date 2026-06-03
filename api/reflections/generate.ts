// Manual trigger so a rollup can be generated on demand (e.g. backfilling May
// before the cron ever fires). Same Bearer guard as the cron.
//   POST /api/reflections/generate
//   Authorization: Bearer ${CRON_SECRET}
//   { "owner": "<user-uuid>", "type": "weekly" | "monthly", "start": "2026-05-01", "end": "2026-05-31" }

import { isAuthorized, unauthorized } from '../_lib/auth'
import { buildWeekly, buildMonthly, buildQuarterly, buildYearly } from '../_lib/synthesize'
import type { RollupType } from '../_lib/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUILDERS = {
  weekly: buildWeekly,
  monthly: buildMonthly,
  quarterly: buildQuarterly,
  yearly: buildYearly,
} as const

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  let body: { owner?: string; type?: string; start?: string; end?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { owner, type, start, end } = body
  if (!owner || !UUID_RE.test(owner)) {
    return Response.json({ error: 'owner (user UUID) is required' }, { status: 400 })
  }
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return Response.json({ error: 'start and end (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (!type || !(type in BUILDERS)) {
    return Response.json(
      { error: "type must be 'weekly', 'monthly', 'quarterly', or 'yearly'" },
      { status: 400 },
    )
  }

  const period = { start, end }

  try {
    const result = await BUILDERS[type as RollupType](owner, period)
    return Response.json(result)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
