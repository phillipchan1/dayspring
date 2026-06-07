// User-authed trigger: the client POSTs here when an import finishes, with the
// imported date range. Enqueues the per-owner backfill job set. The frontend then
// reads processing_jobs directly under RLS (Realtime) for live progress — no
// status endpoint needed. See docs/PROCESSING_AND_ONBOARDING.md §6.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth'
import { enqueueBackfill, kickWorker } from '../_lib/processing'
import type { Period } from '../_lib/dates'

function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 })
  }

  const range = (body as { range?: Partial<Period> } | null)?.range
  if (!range || !isDateStr(range.start) || !isDateStr(range.end)) {
    return Response.json(
      { error: 'range.start and range.end must be YYYY-MM-DD' },
      { status: 400 },
    )
  }

  try {
    const result = await enqueueBackfill(user.id, { start: range.start, end: range.end })
    // Start draining immediately — the worker self-chains from here (no cron needed).
    if (result.enqueued.length > 0) kickWorker()
    return Response.json({ ok: true, ...result })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'enqueue failed' },
      { status: 500 },
    )
  }
}
