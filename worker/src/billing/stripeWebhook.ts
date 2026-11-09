import Stripe from 'stripe'
import type { Plan } from '../../../api/_lib/entitlement.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import {
  updateSubscriptionByStripeCustomer,
  updateSubscriptionByUserId,
  type BillingWriteCtx,
  type WriteOutcome,
} from './updateSubscription.ts'
import type { WaitUntil } from './growth.ts'

export function currentPeriodEnd(sub: Stripe.Subscription): string | null {
  const ends = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((t): t is number => typeof t === 'number')
  if (ends.length === 0) return null
  return new Date(Math.max(...ends) * 1000).toISOString()
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent
  if (parent?.type !== 'subscription_details') return null
  const sub = parent.subscription_details?.subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

export function stripeStatusToPlan(status: Stripe.Subscription.Status): Plan {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled'
    default:
      return 'none'
  }
}

export interface StripeBillingClient {
  webhooks: {
    constructEvent: typeof Stripe.webhooks.constructEvent
    constructEventAsync?: typeof Stripe.webhooks.constructEventAsync
  }
  subscriptions: {
    retrieve: (id: string) => Promise<Stripe.Subscription>
  }
}

export function stripeClientFromEnv(env: Env): Stripe {
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing required server env: STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

function report(eventType: string, key: string, outcome: WriteOutcome): void {
  if (outcome === 'no-match') {
    console.warn(`[stripe webhook] ${eventType}: no profile for ${key}`)
  }
}

async function currentSubscription(
  stripe: StripeBillingClient,
  eventSub: Stripe.Subscription,
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(eventSub.id)
  } catch (e) {
    console.warn(`[stripe webhook] could not re-read subscription ${eventSub.id}`, e)
    return eventSub
  }
}

export async function handleStripeEvent(
  ctx: BillingWriteCtx,
  stripe: StripeBillingClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (!userId || !customerId) break

      const sub =
        typeof session.subscription === 'string'
          ? await stripe.subscriptions.retrieve(session.subscription)
          : (session.subscription as Stripe.Subscription | null)

      const plan = sub ? stripeStatusToPlan(sub.status) : 'active'

      const outcome = await updateSubscriptionByUserId(ctx, userId, {
        plan: plan === 'none' ? 'active' : plan,
        trial_ends_at: sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        plan_expires_at: sub ? currentPeriodEnd(sub) : null,
        stripe_customer_id: customerId,
        source: 'stripe',
      })
      report(event.type, `owner ${userId}`, outcome)
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const eventSub = event.data.object as Stripe.Subscription
      const customerId =
        typeof eventSub.customer === 'string' ? eventSub.customer : eventSub.customer.id

      const sub = await currentSubscription(stripe, eventSub)

      const outcome = await updateSubscriptionByStripeCustomer(ctx, customerId, {
        plan: stripeStatusToPlan(sub.status),
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        plan_expires_at: currentPeriodEnd(sub),
        source: 'stripe',
      })
      report(event.type, `stripe customer ${customerId}`, outcome)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      const outcome = await updateSubscriptionByStripeCustomer(ctx, customerId, {
        plan: 'cancelled',
        plan_expires_at: new Date(event.created * 1000).toISOString(),
        source: 'stripe',
      })
      report(event.type, `stripe customer ${customerId}`, outcome)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) break
      if (!invoiceSubscriptionId(invoice)) break

      const outcome = await updateSubscriptionByStripeCustomer(ctx, customerId, {
        plan: 'past_due',
        plan_expires_at: new Date(event.created * 1000).toISOString(),
        source: 'stripe',
      })
      report(event.type, `stripe customer ${customerId}`, outcome)
      break
    }

    default:
      break
  }
}

export async function handleStripeWebhook(
  req: Request,
  sql: Sql,
  env: Env,
  waitUntil?: WaitUntil,
  stripeOverride?: StripeBillingClient,
): Promise<Response> {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return Response.json({ error: 'missing signature' }, { status: 400 })

  let event: Stripe.Event
  let stripe: StripeBillingClient
  try {
    const raw = await req.text()
    stripe = stripeOverride ?? stripeClientFromEnv(env)
    const secret = env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error('Missing required server env: STRIPE_WEBHOOK_SECRET')
    event = stripe.webhooks.constructEventAsync
      ? await stripe.webhooks.constructEventAsync(raw, sig, secret)
      : stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (e) {
    return Response.json(
      { error: `webhook signature failed: ${e instanceof Error ? e.message : 'unknown'}` },
      { status: 400 },
    )
  }

  try {
    await handleStripeEvent({ sql, env, waitUntil }, stripe, event)
  } catch (e) {
    console.error('[stripe webhook] handler error', event.type, e)
    return Response.json({ error: 'handler failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}
