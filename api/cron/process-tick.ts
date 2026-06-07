// Drain worker for the processing engine (vercel.json → "* * * * *"). Each tick
// claims up to K jobs and advances each by one bounded chunk, then returns. A
// decade-import drains over many ticks with live progress; crashes self-heal via
// the 5-minute lock reclaim. See docs/PROCESSING_AND_ONBOARDING.md §4.

import { isAuthorized, unauthorized } from '../_lib/auth'
import { drain } from '../_lib/processing'

// Owners processed per tick — also the natural OpenAI rate cap. skip-locked makes
// overlapping ticks safe.
const K = 4

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const ranAt = new Date().toISOString()
  try {
    const results = await drain(K)
    return Response.json({ ran_at: ranAt, claimed: results.length, results })
  } catch (e) {
    return Response.json(
      { ran_at: ranAt, error: e instanceof Error ? e.message : 'tick failed' },
      { status: 500 },
    )
  }
}
