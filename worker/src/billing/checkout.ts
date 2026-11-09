import type Stripe from 'stripe'
import { appleMayStillCharge, type PlanState } from '../../../api/_lib/entitlement.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import { planStateByOwner } from './updateSubscription.ts'

export async function handleStripeCheckout(
  req: Request,
  sql: Sql,
  env: Env,
  user: { id: string; email?: string | null },
  stripe: {
    checkout: {
      sessions: {
        create: (
          params: Stripe.Checkout.SessionCreateParams,
        ) => Promise<Pick<Stripe.Checkout.Session, 'url'>>
      }
    }
  },
): Promise<Response> {
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

  const annual = env.STRIPE_ANNUAL_PRICE_ID
  const monthly = env.STRIPE_MONTHLY_PRICE_ID
  if (!annual) throw new Error('Missing required server env: STRIPE_ANNUAL_PRICE_ID')
  if (!monthly) throw new Error('Missing required server env: STRIPE_MONTHLY_PRICE_ID')
  const priceId = plan === 'annual' ? annual : monthly
  const appUrl = env.APP_URL ?? 'https://dayspring-eosin.vercel.app'

  const profile = await planStateByOwner(sql, user.id)
  if (appleMayStillCharge(profile as PlanState | null)) {
    return Response.json(
      {
        error:
          'Your subscription is billed through the App Store. Manage it in Settings on your ' +
          'iPhone or iPad, or at apps.apple.com/account/subscriptions in any browser.',
        code: 'managed_by_apple',
      },
      { status: 409 },
    )
  }

  const existingCustomerId = profile?.stripe_customer_id ?? undefined
  const requireCard = (env.ONBOARDING_REQUIRE_CARD ?? 'false').toLowerCase() === 'true'

  const session = await stripe.checkout.sessions.create({
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

  return Response.json({ url: session.url })
}
