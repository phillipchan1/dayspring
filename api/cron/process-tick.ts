// Drain worker for the processing engine. Each tick claims up to K jobs and
// advances each by one bounded chunk, then returns. The engine SELF-CHAINS —
// enqueue kicks the first tick and each working tick kicks the next (kickWorker)
// — so an archive drains in the background without a sub-minute cron (Vercel
// Hobby-safe). The daily cron in vercel.json is only a backstop to restart any
// chain that stalled; crashes also self-heal via the 5-minute lock reclaim.
// See docs/PROCESSING_AND_ONBOARDING.md §4.

import { isAuthorized, unauthorized } from '../_lib/auth'
import { drain, kickWorker } from '../_lib/processing'

// Owners processed per tick — also the natural OpenAI rate cap. skip-locked makes
// overlapping ticks safe.
const K = 4

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const ranAt = new Date().toISOString()
  try {
    const results = await drain(K)
    // Self-chain: if this tick did work, more chunks likely remain — kick the
    // next tick. Stops naturally when a tick claims nothing (chain ends).
    if (results.length > 0) kickWorker()
    return Response.json({ ran_at: ranAt, claimed: results.length, results })
  } catch (e) {
    return Response.json(
      { ran_at: ranAt, error: e instanceof Error ? e.message : 'tick failed' },
      { status: 500 },
    )
  }
}
