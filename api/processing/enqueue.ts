// User-authed trigger: the client POSTs here when an import finishes, with the
// imported date range. Enqueues the per-owner backfill job set. The frontend then
// reads processing_jobs directly under RLS (Realtime) for live progress — no
// status endpoint needed. See docs/PROCESSING_AND_ONBOARDING.md §6.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth'
import { enqueueBackfill, kickWorker } from '../_lib/processing'
import { supabaseAdmin } from '../_lib/supabaseAdmin'
import type { Period } from '../_lib/dates'

function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** Derive the backfill window from the owner's own entries (min/max created_at).
 *  Returns null for an empty journal (nothing to build). */
async function deriveRange(owner: string): Promise<Period | null> {
  const sb = supabaseAdmin()
  const earliest = await sb
    .from('entries')
    .select('created_at')
    .eq('owner', owner)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const latest = await sb
    .from('entries')
    .select('created_at')
    .eq('owner', owner)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const start = earliest.data?.created_at
  const end = latest.data?.created_at
  if (!start || !end) return null
  return { start: String(start).slice(0, 10), end: String(end).slice(0, 10) }
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  // Body is optional: an explicit {range} from the import flow, or empty for the
  // catch-up trigger (range derived from the owner's entries).
  const body = (await req.json().catch(() => null)) as { range?: Partial<Period> } | null
  const given = body?.range

  try {
    let range: Period | null
    if (given && isDateStr(given.start) && isDateStr(given.end)) {
      range = { start: given.start, end: given.end }
    } else {
      range = await deriveRange(user.id)
    }
    if (!range) {
      // Empty journal — nothing to backfill yet.
      return Response.json({ ok: true, enqueued: [] })
    }

    const result = await enqueueBackfill(user.id, range)
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
