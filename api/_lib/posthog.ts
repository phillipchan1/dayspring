// Server-side usage events — subscription lifecycle only.
//
// ─── Why this exists at all ─────────────────────────────────────────────────
//
// Everything else we measure happens in a browser, where lib/analytics.ts
// already handles it. Subscription lifecycle does not: a renewal twelve months
// from now, a card that fails at 3am, a cancellation made in Stripe's own
// billing portal — nobody is looking at the app when any of those happen, and
// they are exactly the outcomes D-002 and D-003 need. So these four events come
// from the webhook that learns about them.
//
// ─── distinct_id must be the Supabase auth UUID ─────────────────────────────
//
// Not the Stripe customer id, not the Apple transaction id. The browser
// identifies people by their Supabase auth UUID (see App.tsx), so anything
// keyed differently lands on a second, unrelated person record and the join
// that makes this worth building — onboarding fork on day 0, conversion on day
// 14 — silently produces nothing. The `owner` column on `profiles` IS that
// UUID, which is why every resolver below goes through that table.
//
// A lookup that finds no profile means the event is unattributable. We drop it.
// Inventing a distinct_id would be worse than missing data: it manufactures a
// person who does not exist and quietly inflates every denominator.
//
// ─── Why raw fetch and not posthog-node ─────────────────────────────────────
//
// posthog-node brings a background flush queue and a shutdown handshake, both
// of which are actively wrong in a serverless function that gets frozen the
// moment it responds. We send one HTTP request and we know when it's done.
// A dependency whose entire job is batching is a liability where there is no
// process to batch across.
//
// ─── Why waitUntil ──────────────────────────────────────────────────────────
//
// A bare fire-and-forget promise is not "best effort" on Vercel — it is
// *dropped*, because the function is frozen as soon as the response is
// returned, usually before the socket has even opened. waitUntil is what keeps
// the invocation alive long enough for the request to land. Same reason
// _lib/processing.ts uses it.
//
// ─── This module may never throw ────────────────────────────────────────────
//
// It is called from Stripe and Apple webhook handlers. A throw there becomes a
// non-2xx, which makes the store retry, which re-runs a subscription write. We
// are not risking somebody's billing state for a metric. Every path below is
// caught; the worst outcome is a missing event.

import { waitUntil } from '@vercel/functions'
import { env } from './env.js'
import { supabaseAdmin } from './supabaseAdmin.js'

/**
 * The closed server-side vocabulary.
 *
 * Same rule as the client (lib/analytics.ts): enums, numbers and booleans only.
 * There is no free-text property here and there must never be one — a Stripe
 * failure message or a product name is vendor text we have no business
 * forwarding, and it is the obvious thing to reach for while debugging.
 */
export type ServerEvent =
  | 'subscription_activated'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'payment_failed'

export type PlanSource = 'stripe' | 'apple'

export interface ServerEventProps {
  /** Which store the money moved through. */
  store: PlanSource
  /** Billing cadence where the event knows it. */
  interval?: 'monthly' | 'annual' | 'unknown'
  /** True when this activation converted a trial rather than starting cold. */
  from_trial?: boolean
}

/** POST one event. Resolves to false on any failure; never rejects. */
async function send(
  distinctId: string,
  event: ServerEvent,
  properties: ServerEventProps,
): Promise<boolean> {
  const key = env.posthogKey()
  if (!key) return false

  try {
    const res = await fetch(`${env.posthogHost().replace(/\/$/, '')}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          // Marks the event as server-authored so a funnel can tell a webhook
          // fact from a browser claim. Both are true; they fail differently.
          source: 'server',
        },
        timestamp: new Date().toISOString(),
      }),
    })
    if (!res.ok) {
      console.warn(`[posthog] ${event} → ${res.status}`)
      return false
    }
    return true
  } catch (e) {
    console.warn(`[posthog] ${event} failed`, e)
    return false
  }
}

/** The Supabase auth UUID behind a Stripe customer, or null if none claims it. */
async function ownerByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin()
      .from('profiles')
      .select('owner')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle<{ owner: string }>()
    return data?.owner ?? null
  } catch {
    return null
  }
}

/** The Supabase auth UUID behind an Apple subscription, or null. */
async function ownerByAppleOriginalTxn(originalTransactionId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin()
      .from('profiles')
      .select('owner')
      .eq('apple_original_txn', originalTransactionId)
      .maybeSingle<{ owner: string }>()
    return data?.owner ?? null
  } catch {
    return null
  }
}

/** How the caller says who this is about. */
export type SubjectRef =
  | { by: 'owner'; id: string }
  | { by: 'stripeCustomer'; id: string }
  | { by: 'appleOriginalTxn'; id: string }

async function resolveOwner(ref: SubjectRef): Promise<string | null> {
  if (ref.by === 'owner') return ref.id || null
  if (ref.by === 'stripeCustomer') return ownerByStripeCustomer(ref.id)
  return ownerByAppleOriginalTxn(ref.id)
}

/**
 * Record a subscription lifecycle event.
 *
 * Returns immediately — the resolve-and-send runs under waitUntil. Call it from
 * a webhook handler without awaiting; it cannot throw and it cannot fail the
 * request. The only visible effect of anything going wrong is a console warning
 * and a missing data point.
 */
export function trackServerEvent(
  ref: SubjectRef,
  event: ServerEvent,
  properties: ServerEventProps,
): void {
  if (!env.posthogKey()) return
  try {
    waitUntil(
      (async () => {
        const owner = await resolveOwner(ref)
        if (!owner) {
          // Real and expected: a lifecycle event can overtake its own
          // checkout.session.completed, so no profile carries the customer id
          // yet. Say so rather than inventing an id — an invented distinct_id
          // creates a phantom person and inflates every denominator it touches.
          console.warn(`[posthog] ${event}: no profile for ${ref.by} ${ref.id}`)
          return
        }
        await send(owner, event, properties)
      })().catch((e) => {
        console.warn(`[posthog] ${event} dispatch failed`, e)
      }),
    )
  } catch {
    // waitUntil throws outside a request context (e.g. a unit test). Swallow —
    // measurement is never allowed to be the reason a webhook fails.
  }
}
