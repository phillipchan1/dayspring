// POST /api/webhooks/stripe
// Stripe webhook endpoint. Validates the signature and handles subscription lifecycle events.
// No user auth — Stripe calls this directly. Verified via STRIPE_WEBHOOK_SECRET.
//
// Every write goes through updateSubscription.ts, which refuses to let a stale
// Stripe event revoke a live App Store subscription. See shouldApplyUpdate().

import type Stripe from 'stripe'
import { stripe } from '../_lib/stripe.js'
import { env } from '../_lib/env.js'
import {
  updateSubscriptionByUserId,
  updateSubscriptionByStripeCustomer,
  type WriteOutcome,
} from '../_lib/updateSubscription.js'
import type { Plan } from '../_lib/entitlement.js'

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

/**
 * When the currently-paid-for period runs out.
 *
 * Stripe moved this off the subscription and onto its items in the
 * 2025-03-31.basil API; on `2026-05-27.dahlia` there is no
 * `subscription.current_period_end` at all. Items can in principle bill on
 * different schedules, so take the furthest — access should end when the last
 * thing they paid for does.
 *
 * Recording it is what makes a *dropped* Stripe event survivable: isEntitled()
 * lapses an `active` row a few days past its expiry instead of granting access
 * forever on a renewal we never heard about.
 */
export function currentPeriodEnd(sub: Stripe.Subscription): string | null {
  const ends = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((t): t is number => typeof t === 'number')
  if (ends.length === 0) return null
  return new Date(Math.max(...ends) * 1000).toISOString()
}

/**
 * Re-read a subscription from Stripe so an out-of-order delivery cannot write a
 * stale status. Falls back to the event's own copy on any failure — a slightly
 * stale write beats a dropped event, and the next lifecycle event corrects it.
 */
async function currentSubscription(eventSub: Stripe.Subscription): Promise<Stripe.Subscription> {
  try {
    return await stripe().subscriptions.retrieve(eventSub.id)
  } catch (e) {
    console.warn(`[stripe webhook] could not re-read subscription ${eventSub.id}`, e)
    return eventSub
  }
}

/** The subscription an invoice belongs to, or null for one-off invoices.
 *  `invoice.subscription` was removed in the 2025-03-31.basil API. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent
  if (parent?.type !== 'subscription_details') return null
  const sub = parent.subscription_details?.subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

function report(eventType: string, key: string, outcome: WriteOutcome): void {
  if (outcome === 'no-match') {
    // Usually a lifecycle event that overtook its own checkout.session.completed
    // — the customer id isn't on any profile yet. Harmless once, suspicious in
    // bulk, and previously invisible because .update() on zero rows succeeds.
    console.warn(`[stripe webhook] ${eventType}: no profile for ${key}`)
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (!userId || !customerId) break

      // Derive the plan from the real Stripe subscription status rather than
      // assuming a trial. This supports both onboarding models:
      //  • app-managed reverse trial (default): the in-app trial already ran, so
      //    Checkout creates an immediately-active subscription → status 'active'
      //    → plan 'active'.
      //  • card-first: Checkout attaches trial_period_days → status 'trialing'
      //    → plan 'trialing'.
      const sub =
        typeof session.subscription === 'string'
          ? await stripe().subscriptions.retrieve(session.subscription)
          : (session.subscription as Stripe.Subscription | null)

      const plan = sub ? stripeStatusToPlan(sub.status) : 'active'

      const outcome = await updateSubscriptionByUserId(userId, {
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
      // `.updated` covers far more than cancellation: plan switches, trial
      // conversion, and recovery from past_due back to active all arrive here.
      const eventSub = event.data.object as Stripe.Subscription
      const customerId =
        typeof eventSub.customer === 'string' ? eventSub.customer : eventSub.customer.id

      // Re-read the subscription instead of trusting the event body. Stripe
      // gives no ordering guarantee, so two `.updated` events can arrive
      // reversed and write a stale status over a newer one — the same class of
      // bug as the cross-store clobber, but within a single store, where the
      // guard cannot help because the source matches.
      //
      // This mirrors what the Apple path already does: the notification tells us
      // *which* subscription moved, and an authoritative read tells us *what is
      // true now*. Out-of-order and duplicate deliveries then converge instead
      // of racing. If the re-read fails we fall back to the event body, which is
      // still better than dropping the event.
      const sub = await currentSubscription(eventSub)

      const outcome = await updateSubscriptionByStripeCustomer(customerId, {
        plan: stripeStatusToPlan(sub.status),
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        // Set even when cancel_at_period_end is true: the user keeps what they
        // paid for, and the row lapses on its own if the eventual `.deleted`
        // never reaches us.
        plan_expires_at: currentPeriodEnd(sub),
        source: 'stripe',
      })
      report(event.type, `stripe customer ${customerId}`, outcome)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      const outcome = await updateSubscriptionByStripeCustomer(customerId, {
        plan: 'cancelled',
        // Stripe only fires this once the paid period is genuinely over, so the
        // event time is the honest end. `cancelled` gets no grace regardless.
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

      // Only a failed *subscription* invoice means the subscription is in
      // trouble. Unscoped, a failed one-off invoice locked the customer out of a
      // perfectly healthy subscription.
      if (!invoiceSubscriptionId(invoice)) break

      const outcome = await updateSubscriptionByStripeCustomer(customerId, {
        plan: 'past_due',
        // Starts the dunning grace clock. Without a timestamp isEntitled()
        // treats past_due as immediately over — evicted from your own journal
        // the hour a card expires, while Stripe is still happily retrying it.
        plan_expires_at: new Date(event.created * 1000).toISOString(),
        source: 'stripe',
      })
      report(event.type, `stripe customer ${customerId}`, outcome)
      break
    }

    default:
      // Unhandled events are fine — Stripe sends many we don't care about.
      break
  }
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
