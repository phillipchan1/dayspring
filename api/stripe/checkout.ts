// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for the selected plan (annual | monthly).
// Requires: Authorization: Bearer <supabase-jwt>
// Body: { plan: 'annual' | 'monthly' }
// Returns: { url: string }

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { stripe } from '../_lib/stripe.js'
import { env } from '../_lib/env.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { appleMayStillCharge, type PlanState } from '../_lib/entitlement.js'
import { preflight, withCors } from '../_lib/cors.js'

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  let body: { plan?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const { plan } = body
  if (plan !== 'annual' && plan !== 'monthly') {
    return withCors(req, Response.json({ error: "plan must be 'annual' or 'monthly'" }, { status: 400 }))
  }

  const priceId = plan === 'annual' ? env.stripeAnnualPriceId() : env.stripeMonthlyPriceId()
  const appUrl = env.appUrl()

  // Reuse an existing Stripe customer if we already have one.
  const sb = supabaseAdmin()
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id, plan, plan_source, trial_ends_at, plan_expires_at')
    .eq('owner', user.id)
    .maybeSingle<
      { stripe_customer_id: string | null } & PlanState
    >()

  // Never let someone end up paying twice for the same journal. While Apple may
  // still charge this account, Stripe checkout is closed — they settle it with
  // Apple first, and only then can they subscribe here.
  //
  // Not `plan_source === 'apple'` alone, and it must stay that way: someone
  // whose App Store subscription has genuinely expired owes Apple nothing, and
  // blocking them here strands anyone who cancelled on iOS and no longer has the
  // device. This is the server half of the client's purchaseRoute() — if the two
  // drift, the paywall offers a button the server rejects.
  if (appleMayStillCharge(profile)) {
    return withCors(
      req,
      Response.json(
        {
          error:
            'Your subscription is billed through the App Store. Manage it in Settings on your ' +
            'iPhone or iPad, or at apps.apple.com/account/subscriptions in any browser.',
          code: 'managed_by_apple',
        },
        { status: 409 },
      ),
    )
  }

  const existingCustomerId = profile?.stripe_customer_id ?? undefined

  // Trial model (see api/_lib/env.ts → onboardingRequireCard):
  //  • app-managed (default): the 14-day reverse trial was already granted in-app
  //    at first sign-in, so tapping "Subscribe" converts straight to a paid
  //    subscription — no second trial here.
  //  • card-first: Checkout is where the trial starts, so attach trial_period_days.
  const requireCard = env.onboardingRequireCard()

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: existingCustomerId,
    ...(!existingCustomerId && user.email ? { customer_email: user.email } : {}),
    line_items: [{ price: priceId, quantity: 1 }],
    ...(requireCard ? { subscription_data: { trial_period_days: 14 } } : {}),
    client_reference_id: user.id,
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancelled`,
    allow_promotion_codes: true,
  })

  return withCors(req, Response.json({ url: session.url }))
}
