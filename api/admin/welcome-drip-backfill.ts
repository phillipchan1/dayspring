// POST /api/admin/welcome-drip-backfill
//
//   Authorization: Bearer ${CRON_SECRET}
//   body: { dry_run?: boolean }   // default true
//
// One-shot enroll of every auth user as feature-discovery (not fake day-0).
// Dry-run returns would_enroll / would_send / would_skip per step and never
// writes or calls Resend. A write still will not mail anyone unless
// WELCOME_DRIP_SENDS_ENABLED=true — and this endpoint only records skips,
// it does not send.

import { isAuthorized, unauthorized } from '../_lib/auth.js'
import { parseDryRun } from '../_lib/welcomeDrip.js'
import { liveWelcomeDripDeps, runWelcomeDripBackfill } from '../_lib/welcomeDripRun.js'

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const dryRun = parseDryRun(body, new URL(req.url))

  try {
    const result = await runWelcomeDripBackfill(liveWelcomeDripDeps(), { dryRun })
    return Response.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[welcome-drip-backfill]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
