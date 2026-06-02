// POST /api/spiritual/scripture-resolve
// Authenticated via the user's Supabase JWT (Authorization: Bearer <token>).
//
// PHASE 2 of the progressive lookup. Given references the model picked (phase 1,
// /api/spiritual/scripture), resolve each to verbatim ESV text — cache-first,
// falling back to Crossway's API. The client calls this right after rendering
// the references, so verse text fills in behind them.
//
// Returns one slot per input reference, in order: { reference, text } when it
// resolves, or null when the ESV API doesn't recognize it (the client drops it
// and backfills from the spare candidates).

import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { resolvePassage, ESV_COPYRIGHT } from '../_lib/esv.js'
import { corsHeaders, preflight, withCors } from '../_lib/cors.js'

const MAX_REFS = 10

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!jwt) return withCors(req, Response.json({ error: 'unauthorized' }, { status: 401 }))

  const sb = supabaseAdmin()
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser(jwt)
  if (authError || !user) return withCors(req, Response.json({ error: 'unauthorized' }, { status: 401 }))

  let body: { references?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const references = Array.isArray(body.references)
    ? body.references.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, MAX_REFS)
    : []
  if (references.length === 0) {
    return withCors(req, Response.json({ error: 'references is required' }, { status: 400 }))
  }

  try {
    const resolved = await Promise.all(
      references.map(async (ref) => {
        const hit = await resolvePassage(ref)
        return hit ? { reference: hit.reference, text: hit.text } : null
      }),
    )
    return withCors(req, Response.json({ resolved, copyright: ESV_COPYRIGHT }))
  } catch (e) {
    return withCors(req, Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }))
  }
}
