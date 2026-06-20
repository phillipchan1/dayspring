// POST /api/concordance/rebuild — the "derived, not authoritative" safety net.
// Wipes and regenerates an owner's Concordance into concordance_shadow purely
// from the event log (machine observations traceable to entries + user
// corrections) and reports drift against the live table. Admin-triggered stub
// for now (same Bearer guard as the cron); nothing user-facing.
//   Authorization: Bearer ${CRON_SECRET}
//   { "owner": "<uuid>" }   — required (the engine is per-owner; no app default)

import { isAuthorized, unauthorized } from '../_lib/auth.js'
import { rebuildConcordance } from '../_lib/concordance.js'

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  let body: { owner?: string }
  try {
    body = (await req.json().catch(() => ({}))) as typeof body
  } catch {
    body = {}
  }
  const owner = body.owner
  if (!owner) {
    return Response.json({ error: 'owner is required' }, { status: 400 })
  }

  try {
    const result = await rebuildConcordance(owner)
    return Response.json(result)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'rebuild failed' },
      { status: 500 },
    )
  }
}
