// POST /api/trial/extend
// One-time, self-serve trial extension (+7 days). Requires: Authorization Bearer
// <supabase-jwt>. Idempotent guard: a 'trial_extended' marker in profiles.feature_flags
// means it's already been used → 409. Returns: { trial_ends_at }.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'

const EXTENSION_DAYS = 7
const MARKER = 'trial_extended'

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  const sb = supabaseAdmin()
  const { data: profile, error } = await sb
    .from('profiles')
    .select('trial_ends_at, feature_flags')
    .eq('owner', user.id)
    .maybeSingle()
  if (error) return withCors(req, Response.json({ error: error.message }, { status: 500 }))

  const flags: string[] = Array.isArray(profile?.feature_flags) ? (profile!.feature_flags as string[]) : []
  if (flags.includes(MARKER)) {
    return withCors(req, Response.json({ error: 'Trial already extended once.' }, { status: 409 }))
  }

  // Extend from whichever is later — now or the (possibly future) current end —
  // so an early extension doesn't shorten the remaining trial.
  const now = Date.now()
  const currentEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : now
  const base = Math.max(now, currentEnd)
  const newEnd = new Date(base + EXTENSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: upErr } = await sb
    .from('profiles')
    .update({ plan: 'trialing', trial_ends_at: newEnd, feature_flags: [...flags, MARKER] })
    .eq('owner', user.id)
  if (upErr) return withCors(req, Response.json({ error: upErr.message }, { status: 500 }))

  return withCors(req, Response.json({ trial_ends_at: newEnd }))
}
