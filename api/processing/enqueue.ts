// User-authed trigger: the client POSTs here when an import finishes, with the
// imported date range. Enqueues the per-owner backfill job set. The frontend then
// reads processing_jobs directly under RLS (Realtime) for live progress — no
// status endpoint needed. See docs/PROCESSING_AND_ONBOARDING.md §6.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { enqueueBackfill, kickWorker } from '../_lib/processing.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'
import type { Period } from '../_lib/dates.js'

function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** Has this owner ever been processed? True if any processing_jobs row (any
 *  status) or any derived insight exists. Runs under admin — authoritative and
 *  immune to the per-device auth/RLS timing that the client-side guard depends on.
 *  This is what makes the catch-up trigger truly once-per-owner: a fresh-device
 *  login can't re-backfill an already-built archive. The import flow bypasses this
 *  by passing an explicit range. */
async function alreadyProcessed(owner: string): Promise<boolean> {
  const sb = supabaseAdmin()
  const jobs = await sb.from('processing_jobs').select('id').eq('owner', owner).limit(1)
  if ((jobs.data?.length ?? 0) > 0) return true
  const insights = await sb.from('insights').select('id').eq('owner', owner).limit(1)
  return (insights.data?.length ?? 0) > 0
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

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  // Body is optional: an explicit {range} from the import flow, or empty for the
  // catch-up trigger (range derived from the owner's entries).
  const body = (await req.json().catch(() => null)) as { range?: Partial<Period> } | null
  const given = body?.range

  try {
    let range: Period | null
    if (given && isDateStr(given.start) && isDateStr(given.end)) {
      range = { start: given.start, end: given.end }
    } else {
      // Catch-up trigger (no explicit range). Authoritative server-side guard:
      // if this owner has ever been processed, no-op. This is the once-per-owner
      // backstop — it can't be bypassed by a fresh device whose client-side guard
      // raced auth/RLS and saw an (apparently) empty account. The import flow is
      // unaffected: it always passes an explicit range and skips this branch.
      if (await alreadyProcessed(user.id)) {
        return withCors(req, Response.json({ ok: true, enqueued: [], skipped: 'already-processed' }))
      }
      range = await deriveRange(user.id)
    }
    if (!range) {
      // Empty journal — nothing to backfill yet.
      return withCors(req, Response.json({ ok: true, enqueued: [] }))
    }

    const result = await enqueueBackfill(user.id, range)
    // Start draining immediately — the worker self-chains from here (no cron needed).
    if (result.enqueued.length > 0) kickWorker()
    return withCors(req, Response.json({ ok: true, ...result }))
  } catch (e) {
    return withCors(
      req,
      Response.json({ error: e instanceof Error ? e.message : 'enqueue failed' }, { status: 500 }),
    )
  }
}
