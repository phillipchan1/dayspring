// The client paints the UI from src/lib/subscription.ts; the server enforces
// access from api/_lib/entitlement.ts. They are separate files because the API
// runs as ESM with server-only neighbours and must never be pulled into the
// browser bundle — but a disagreement between them is either a lockout (server
// says no, client showed the journal) or a free ride (client says no, server
// never checks). This suite sweeps the whole state space and fails on the first
// divergence, so the duplication stays honest.

import { describe, it, expect } from 'vitest'
import {
  isEntitled as serverIsEntitled,
  appleMayStillCharge as serverAppleMayStillCharge,
  isAppleRelationship as serverIsAppleRelationship,
  GRACE_DAYS as SERVER_GRACE_DAYS,
  type Plan,
  type PlanSource,
} from './entitlement'
import {
  isEntitled as clientIsEntitled,
  appleMayStillCharge as clientAppleMayStillCharge,
  isAppleRelationship as clientIsAppleRelationship,
  GRACE_DAYS as CLIENT_GRACE_DAYS,
  type Subscription,
} from '../../src/lib/subscription'

const NOW = Date.parse('2026-08-01T12:00:00.000Z')
const DAY = 86_400_000
const at = (days: number) => new Date(NOW + days * DAY).toISOString()

const PLANS: Plan[] = ['none', 'trialing', 'active', 'cancelled', 'past_due']
const SOURCES: (PlanSource | null)[] = ['stripe', 'apple', null]

/** Every timestamp shape that changes an answer, including the exact grace
 *  boundary in both directions and the values that must fail open. */
const TIMES: (string | null)[] = [
  null,
  at(30),
  at(1),
  at(-0.5),
  at(-SERVER_GRACE_DAYS + 0.01),
  at(-SERVER_GRACE_DAYS),
  at(-SERVER_GRACE_DAYS - 0.01),
  at(-365),
  'not-a-date',
]

interface Case {
  label: string
  plan: Plan
  plan_source: PlanSource | null
  trial_ends_at: string | null
  plan_expires_at: string | null
}

const CASES: Case[] = PLANS.flatMap((plan) =>
  SOURCES.flatMap((plan_source) =>
    TIMES.flatMap((trial_ends_at) =>
      TIMES.map((plan_expires_at) => ({
        label: `plan=${plan} source=${plan_source ?? 'null'} trial=${trial_ends_at} expires=${plan_expires_at}`,
        plan,
        plan_source,
        trial_ends_at,
        plan_expires_at,
      })),
    ),
  ),
)

function asSubscription(c: Case): Subscription {
  return {
    plan: c.plan,
    plan_source: c.plan_source,
    trial_ends_at: c.trial_ends_at,
    plan_expires_at: c.plan_expires_at,
    onboarded_at: null,
    featureFlags: [],
  }
}

describe('client and server entitlement agree', () => {
  it('uses the same grace window on both sides', () => {
    expect(CLIENT_GRACE_DAYS).toBe(SERVER_GRACE_DAYS)
  })

  it(`agrees on isEntitled across all ${CASES.length} states`, () => {
    const divergent = CASES.filter(
      (c) => serverIsEntitled(c, NOW) !== clientIsEntitled(asSubscription(c), NOW),
    )
    expect(divergent.map((c) => c.label)).toEqual([])
  })

  it('agrees on appleMayStillCharge across all states', () => {
    const divergent = CASES.filter(
      (c) => serverAppleMayStillCharge(c) !== clientAppleMayStillCharge(asSubscription(c)),
    )
    expect(divergent.map((c) => c.label)).toEqual([])
  })

  it('agrees on isAppleRelationship across all states', () => {
    const divergent = CASES.filter(
      (c) => serverIsAppleRelationship(c) !== clientIsAppleRelationship(asSubscription(c)),
    )
    expect(divergent.map((c) => c.label)).toEqual([])
  })

  it('agrees that a missing subscription is not entitled', () => {
    expect(serverIsEntitled(null, NOW)).toBe(false)
    expect(clientIsEntitled(null, NOW)).toBe(false)
    expect(serverIsEntitled(undefined, NOW)).toBe(false)
  })
})

describe('the entitlement rule itself', () => {
  // Spot-checks in plain language, so a future reader can see what the sweep
  // above is actually asserting.
  it('never entitles a cancelled plan, whatever the timestamps say', () => {
    const cancelled = CASES.filter((c) => c.plan === 'cancelled')
    expect(cancelled.every((c) => !serverIsEntitled(c, NOW))).toBe(true)
  })

  it('never entitles a plan-less account', () => {
    const none = CASES.filter((c) => c.plan === 'none')
    expect(none.every((c) => !serverIsEntitled(c, NOW))).toBe(true)
  })

  it('entitlement never depends on which store bills the account', () => {
    // A Stripe subscriber is entitled on an iPhone and an App Store subscriber
    // is entitled on the web. Only the purchase and management UI care about
    // plan_source; access itself must not.
    for (const c of CASES) {
      const asStripe = serverIsEntitled({ ...c, plan_source: 'stripe' }, NOW)
      const asApple = serverIsEntitled({ ...c, plan_source: 'apple' }, NOW)
      const asNull = serverIsEntitled({ ...c, plan_source: null }, NOW)
      expect([asApple, asNull]).toEqual([asStripe, asStripe])
    }
  })
})
