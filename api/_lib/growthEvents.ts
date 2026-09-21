// Server-side Exit instrumentation for the subscription lifecycle — StartTrial,
// Purchase, Cancel — sent to PostHog (the same project the app and marketing
// site use, so Trial→Paid can be built as one funnel) and Meta Conversions API
// (so ad spend can optimize toward a real outcome instead of a click). See
// docs/product/GROWTH_PULSE.md for the full event catalogue this belongs to.
//
// This module knows nothing about Stripe, Apple, RevenueCat, or the in-app
// reverse trial. It only answers one question — given the plan a write is
// replacing and the plan it's writing, did a lifecycle moment just happen —
// and, if so, tells the two vendors. Every send is fire-and-forget via
// waitUntil and swallows its own errors: a PostHog or Meta outage must never
// fail a webhook, and must never delay granting someone their trial.

import { createHash } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { env } from './env.js'
import { supabaseAdmin } from './supabaseAdmin.js'
import type { Plan } from './entitlement.js'

export type LifecycleEvent = 'StartTrial' | 'Purchase' | 'Cancel'

/** PostHog's name for each moment — snake_case, matching every event in
 *  src/lib/analytics.ts. Meta CAPI uses the `LifecycleEvent` names verbatim:
 *  they're Meta's own standard-event vocabulary. */
const POSTHOG_EVENT: Record<LifecycleEvent, string> = {
  StartTrial: 'trial_started',
  Purchase: 'subscription_purchased',
  Cancel: 'subscription_cancelled',
}

/**
 * Which lifecycle event (if any) a plan transition represents.
 *
 * Deliberately takes just the two plan values, not a webhook payload:
 * `current` and `next` are exactly what updateSubscription.ts already reads
 * before every write (to decide shouldApplyUpdate). Detection built on that
 * pair can never fire on a write that was dropped as stale, needs no idempotency
 * key of its own, and treats all three stores — and the in-app reverse trial,
 * which never touches a webhook at all — identically: a transition either
 * happened or it didn't.
 *
 * `current: null` means "no profile row yet", read the same as plan 'none'.
 */
export function lifecycleEventFor(current: Plan | null, next: Plan): LifecycleEvent | null {
  const prev = current ?? 'none'
  if (prev === next) return null

  // A trial grant is only a *start* coming from a non-paying state. Apple's
  // BILLING_RETRY→trialing glitches and a paid user somehow re-entering
  // 'trialing' are not trial starts.
  if (next === 'trialing') return prev === 'active' ? null : 'StartTrial'

  // Any other plan becoming 'active' is money changing hands — first purchase,
  // trial conversion, a win-back, or dunning recovering — all real Purchase
  // moments for ad-spend optimization purposes.
  if (next === 'active') return 'Purchase'

  // Only counts as a Cancel when it ends a relationship that was actually
  // live. A row that was already 'none' or 'cancelled' going to 'cancelled'
  // again is a duplicate delivery, not a second cancellation.
  if (next === 'cancelled') {
    return prev === 'active' || prev === 'trialing' || prev === 'past_due' ? 'Cancel' : null
  }

  return null
}

export interface LifecycleParams {
  userId: string
  event: LifecycleEvent
  /** 'reverse-trial' = the app-managed trial grant in api/profile/ensure.ts,
   *  which never goes through a store webhook at all. */
  source: 'stripe' | 'apple' | 'reverse-trial'
}

/** Plan after the transition that produced `event`. These three events are
 *  defined by `lifecycleEventFor` as entering exactly one of these plans. */
const PLAN_AFTER: Record<LifecycleEvent, 'trialing' | 'active' | 'cancelled'> = {
  StartTrial: 'trialing',
  Purchase: 'active',
  Cancel: 'cancelled',
}

/**
 * Person properties stamped on every Exit event via PostHog `$set`.
 * Insights filter `plan=active` and break down by `store` from these, not
 * from the event props — they persist on the person after the event.
 */
export function personPropertiesFor(
  event: LifecycleEvent,
  source: LifecycleParams['source'],
): { plan: 'trialing' | 'active' | 'cancelled'; store: LifecycleParams['source'] } {
  return { plan: PLAN_AFTER[event], store: source }
}

/** Capture properties for the PostHog `/capture/` body — event props plus
 *  `$set` so the person record stays in step with the lifecycle write. */
export function postHogLifecycleProperties(params: LifecycleParams): {
  source: LifecycleParams['source']
  $lib: 'dayspring-server'
  $set: ReturnType<typeof personPropertiesFor>
} {
  return {
    source: params.source,
    $lib: 'dayspring-server',
    $set: personPropertiesFor(params.event, params.source),
  }
}

// ── PostHog ──────────────────────────────────────────────────────────────────

export type PostHogTransport = (body: Record<string, unknown>) => Promise<void>

function livePostHogTransport(): PostHogTransport | null {
  const key = env.posthogKey()
  if (!key) return null
  const host = env.posthogHost()
  return async (body) => {
    const res = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, ...body }),
    })
    if (!res.ok) throw new Error(`PostHog capture ${res.status}`)
  }
}

// ── Meta Conversions API ─────────────────────────────────────────────────────

export type MetaCapiTransport = (body: Record<string, unknown>) => Promise<void>

/** Meta requires PII match keys lowercased, trimmed, then SHA-256 hashed. */
function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function liveMetaCapiTransport(): MetaCapiTransport | null {
  const pixelId = env.metaPixelId()
  const token = env.metaCapiAccessToken()
  if (!pixelId || !token) return null
  return async (body) => {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Meta CAPI ${res.status}: ${detail.slice(0, 300)}`)
    }
  }
}

/** Best-effort — a lookup failure means the CAPI send goes out on external_id
 *  alone rather than blocking or failing the whole lifecycle event. */
async function lookupEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId)
    if (error) return null
    return data?.user?.email ?? null
  } catch {
    return null
  }
}

async function sendLifecycleEvent(
  params: LifecycleParams,
  postHog: PostHogTransport | null,
  metaCapi: MetaCapiTransport | null,
): Promise<void> {
  const email = metaCapi ? await lookupEmail(params.userId) : null
  const eventTimeSec = Math.floor(Date.now() / 1000)

  const sends: Promise<void>[] = []

  if (postHog) {
    sends.push(
      postHog({
        event: POSTHOG_EVENT[params.event],
        distinct_id: params.userId,
        properties: postHogLifecycleProperties(params),
        timestamp: new Date(eventTimeSec * 1000).toISOString(),
      }),
    )
  }

  if (metaCapi) {
    sends.push(
      metaCapi({
        data: [
          {
            event_name: params.event,
            event_time: eventTimeSec,
            // Server-triggered by a webhook or a Supabase write, not a person
            // clicking through Meta's own event-source enum right now.
            action_source: 'system_generated',
            user_data: {
              external_id: sha256(params.userId),
              ...(email ? { em: [sha256(email)] } : {}),
            },
          },
        ],
      }),
    )
  }

  await Promise.all(sends)
}

/**
 * Best-effort, fire-and-forget. Call this and move on — a webhook handler or
 * ensure.ts must return before either vendor call completes, so nothing here
 * is ever awaited by a caller.
 */
export function scheduleLifecycleEvent(params: LifecycleParams): void {
  const postHog = livePostHogTransport()
  const metaCapi = liveMetaCapiTransport()
  if (!postHog && !metaCapi) return // neither vendor configured — nothing to send

  const run = sendLifecycleEvent(params, postHog, metaCapi).catch((e) => {
    console.error(`[growth] ${params.event} (${params.source}) failed`, e)
  })
  try {
    waitUntil(run)
  } catch {
    // waitUntil is only valid inside a request — same fallback as
    // resendAudience.ts's scheduleAccountContactUpsert.
  }
}
