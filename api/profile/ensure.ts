// POST /api/profile/ensure
// Idempotent "initialize my account" call the client makes right after auth.
// Ensures a profiles row exists and — in the app-managed reverse-trial model —
// grants a 14-day trial in Supabase on first sign-in, with NO Stripe object and
// NO card. isEntitled() reads this flag and unlocks everything, so the whole
// welcome + import flow runs inside an already-active trial and gates nothing.
//
// Stripe is only ever touched later, when the user taps "Subscribe" (built
// elsewhere). People who never convert never become Stripe customers.
//
// When ONBOARDING_REQUIRE_CARD is true this grants nothing — the card-first
// Checkout starts the trial instead (see api/stripe/checkout.ts).
//
// Requires: Authorization: Bearer <supabase-jwt>

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { env } from '../_lib/env.js'
import { preflight, withCors } from '../_lib/cors.js'

const TRIAL_DAYS = 14

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  const sb = supabaseAdmin()

  // Read whatever exists today (service role bypasses RLS; scope by owner).
  const { data: existing } = await sb
    .from('profiles')
    .select(
      'plan, plan_source, trial_ends_at, plan_expires_at, stripe_customer_id, apple_original_txn, onboarded_at',
    )
    .eq('owner', user.id)
    .maybeSingle()

  // Eligible for the in-app reverse trial: a genuinely new account that has
  // never had a plan and has never transacted at either store. Never re-grants,
  // never overrides a paid, cancelled, or past-due plan.
  //
  // apple_original_txn is checked alongside stripe_customer_id for the same
  // reason: a returning App Store customer must not be handed a fresh 14 days
  // just because their subscription lapsed back to a plan-less state.
  const grantTrial =
    !env.onboardingRequireCard() &&
    (!existing || existing.plan === 'none') &&
    !existing?.trial_ends_at &&
    !existing?.stripe_customer_id &&
    !existing?.apple_original_txn

  const trialEndsAt = grantTrial
    ? new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
    : (existing?.trial_ends_at ?? null)

  const { data: row, error } = await sb
    .from('profiles')
    .upsert(
      {
        owner: user.id,
        ...(grantTrial
          ? { plan: 'trialing', trial_ends_at: trialEndsAt }
          : {}),
      },
      { onConflict: 'owner' },
    )
    .select('plan, trial_ends_at, plan_expires_at, onboarded_at')
    .single()

  if (error) {
    return withCors(
      req,
      Response.json({ error: error.message }, { status: 500 }),
    )
  }

  return withCors(
    req,
    Response.json({
      plan: row.plan ?? 'none',
      trial_ends_at: row.trial_ends_at ?? null,
      plan_expires_at: row.plan_expires_at ?? null,
      onboarded_at: row.onboarded_at ?? null,
      require_card: env.onboardingRequireCard(),
    }),
  )
}
