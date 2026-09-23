// GET /api/cron/welcome-drip  (Vercel Cron, daily)
// Sends due welcome-series steps for enrolled users. Skip rules run first.
// No Resend calls unless WELCOME_DRIP_SENDS_ENABLED=true and RESEND_API_KEY is set.

import { isAuthorized, unauthorized } from '../_lib/auth.js'
import { liveWelcomeDripDeps, runWelcomeDripCron } from '../_lib/welcomeDripRun.js'

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  try {
    const result = await runWelcomeDripCron(liveWelcomeDripDeps())
    return Response.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[welcome-drip]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
