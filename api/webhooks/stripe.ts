// POST /api/webhooks/stripe
// Stripe webhook endpoint. Validates the signature and handles subscription lifecycle events.
// No user auth — Stripe calls this directly. Verified via STRIPE_WEBHOOK_SECRET.

import type Stripe from 'stripe'
import { stripe } from '../_lib/stripe.js'
import { env } from '../_lib/env.js'
import {
  updateSubscriptionByUserId,
  updateSubscriptionByStripeCustomer,
} from '../_lib/updateSubscription.js'

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return Response.json({ error: 'missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    const raw = await req.text()
    event = stripe().webhooks.constructEvent(raw, sig, env.stripeWebhookSecret())
  } catch (e) {
    return Response.json(
      { error: `webhook signature failed: ${e instanceof Error ? e.message : 'unknown'}` },
      { status: 400 },
    )
  }

  try {
    await handleEvent(event)
  } catch (e) {
    console.error('[stripe webhook] handler error', event.type, e)
    return Response.json({ error: 'handler failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (!userId || !customerId) break

      // Subscription starts in trial.
      const sub =
        typeof session.subscription === 'string'
          ? await stripe().subscriptions.retrieve(session.subscription)
          : (session.subscription as Stripe.Subscription | null)

      const trialEnd = sub?.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null

      await updateSubscriptionByUserId(userId, {
        plan: 'trialing',
        trial_ends_at: trialEnd,
        stripe_customer_id: customerId,
        source: 'stripe',
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

      const plan = stripeStatusToPlan(sub.status)
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null

      await updateSubscriptionByStripeCustomer(customerId, {
        plan,
        trial_ends_at: trialEnd,
        plan_expires_at: periodEnd,
        source: 'stripe',
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      await updateSubscriptionByStripeCustomer(customerId, {
        plan: 'cancelled',
        plan_expires_at: new Date().toISOString(),
        source: 'stripe',
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) break
      await updateSubscriptionByStripeCustomer(customerId, {
        plan: 'past_due',
        source: 'stripe',
      })
      break
    }

    default:
      // Unhandled events are fine — Stripe sends many we don't care about.
      break
  }
}

function stripeStatusToPlan(
  status: Stripe.Subscription.Status,
): 'trialing' | 'active' | 'cancelled' | 'past_due' | 'none' {
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
