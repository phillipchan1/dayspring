// GET /api/stripe/portal
// Creates a Stripe Customer Portal session for the authenticated user.
// Requires: Authorization: Bearer <supabase-jwt>
// Returns: { url: string }

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { stripe } from '../_lib/stripe.js'
import { env } from '../_lib/env.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function GET(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  const sb = supabaseAdmin()
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id')
    .eq('owner', user.id)
    .maybeSingle()

  const customerId = profile?.stripe_customer_id
  if (!customerId) {
    return withCors(req, Response.json({ error: 'no subscription found' }, { status: 404 }))
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: env.appUrl(),
  })

  return withCors(req, Response.json({ url: session.url }))
}
