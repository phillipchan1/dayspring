// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for the selected plan (annual | monthly).
// Requires: Authorization: Bearer <supabase-jwt>
// Body: { plan: 'annual' | 'monthly' }
// Returns: { url: string }

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { stripe } from '../_lib/stripe.js'
import { env } from '../_lib/env.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  let body: { plan?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { plan } = body
  if (plan !== 'annual' && plan !== 'monthly') {
    return Response.json({ error: "plan must be 'annual' or 'monthly'" }, { status: 400 })
  }

  const priceId = plan === 'annual' ? env.stripeAnnualPriceId() : env.stripeMonthlyPriceId()
  const appUrl = env.appUrl()

  // Reuse an existing Stripe customer if we already have one.
  const sb = supabaseAdmin()
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id')
    .eq('owner', user.id)
    .maybeSingle()

  const existingCustomerId = profile?.stripe_customer_id ?? undefined

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: existingCustomerId,
    ...(!existingCustomerId && user.email ? { customer_email: user.email } : {}),
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    client_reference_id: user.id,
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancelled`,
    allow_promotion_codes: true,
  })

  return Response.json({ url: session.url })
}
