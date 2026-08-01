import { describe, it, expect, beforeEach } from 'vitest'
import {
  isEntitled,
  isAppleManaged,
  billingDestination,
  hasBillingRelationship,
  readCachedSubscription,
  writeCachedSubscription,
  SUBSCRIPTION_CACHE_KEY,
  type Subscription,
} from './subscription'

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    plan: 'active',
    plan_source: 'stripe',
    trial_ends_at: null,
    plan_expires_at: null,
    onboarded_at: null,
    featureFlags: [],
    ...overrides,
  }
}

// Minimal localStorage stand-in — the tests run in the `node` environment.
beforeEach(() => {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

describe('isEntitled', () => {
  it('entitles an active plan regardless of which store bills it', () => {
    expect(isEntitled(sub({ plan: 'active', plan_source: 'stripe' }))).toBe(true)
    expect(isEntitled(sub({ plan: 'active', plan_source: 'apple' }))).toBe(true)
  })

  it('entitles a trial only while it is still running', () => {
    const future = new Date(Date.now() + 864e5).toISOString()
    const past = new Date(Date.now() - 864e5).toISOString()
    expect(isEntitled(sub({ plan: 'trialing', trial_ends_at: future }))).toBe(true)
    expect(isEntitled(sub({ plan: 'trialing', trial_ends_at: past }))).toBe(false)
  })

  it('does not entitle cancelled, past_due or absent plans', () => {
    expect(isEntitled(sub({ plan: 'cancelled' }))).toBe(false)
    expect(isEntitled(sub({ plan: 'past_due' }))).toBe(false)
    expect(isEntitled(null)).toBe(false)
  })
})

describe('isAppleManaged', () => {
  // This is the guard that keeps Stripe checkout and the Stripe billing portal
  // hidden from someone Apple already bills. A false negative here means a
  // double charge, so the cases below are deliberately exhaustive.
  it('is true for any Apple-sourced plan that exists', () => {
    for (const plan of ['active', 'trialing', 'past_due', 'cancelled'] as const) {
      expect(isAppleManaged(sub({ plan, plan_source: 'apple' }))).toBe(true)
    }
  })

  it('is false for Stripe-sourced plans', () => {
    expect(isAppleManaged(sub({ plan: 'active', plan_source: 'stripe' }))).toBe(false)
  })

  it('is false when there is no plan at all', () => {
    expect(isAppleManaged(sub({ plan: 'none', plan_source: 'apple' }))).toBe(false)
    expect(isAppleManaged(sub({ plan: 'active', plan_source: null }))).toBe(false)
    expect(isAppleManaged(null)).toBe(false)
  })
})

describe('readCachedSubscription', () => {
  it('round-trips a written subscription', () => {
    const s = sub({ plan: 'active', plan_source: 'apple' })
    writeCachedSubscription(s)
    expect(readCachedSubscription()).toEqual(s)
  })

  it('normalises a pre-plan_source cache to null instead of undefined', () => {
    // Caches written before plan_source existed are still on real devices. If
    // the missing key surfaced as `undefined`, isAppleManaged would still read
    // false — but any `plan_source === undefined` comparison downstream would
    // be a silent landmine. Normalise once, here.
    localStorage.setItem(
      SUBSCRIPTION_CACHE_KEY,
      JSON.stringify({ plan: 'active', trial_ends_at: null, plan_expires_at: null, onboarded_at: null, featureFlags: [] }),
    )
    const cached = readCachedSubscription()
    expect(cached?.plan_source).toBeNull()
    expect(isAppleManaged(cached)).toBe(false)
  })

  it('returns null on absent or corrupt cache rather than throwing', () => {
    expect(readCachedSubscription()).toBeNull()
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, '{not json')
    expect(readCachedSubscription()).toBeNull()
  })
})

describe('billingDestination', () => {
  // The bug this suite exists for: routing was decided device-first, so every
  // Stripe subscriber on an iPhone was sent to the App Store's subscription
  // list — where their subscription does not exist.
  it('keeps a Stripe subscriber on Stripe even on an Apple device', () => {
    const s = sub({ plan: 'active', plan_source: 'stripe' })
    expect(billingDestination(s, { onAppleDevice: true })).toBe('stripe')
    expect(billingDestination(s, { onAppleDevice: false })).toBe('stripe')
  })

  it('sends an Apple subscriber to the native sheet on an Apple device', () => {
    const s = sub({ plan: 'active', plan_source: 'apple' })
    expect(billingDestination(s, { onAppleDevice: true })).toBe('apple-native')
  })

  it('sends an Apple subscriber to the web page when off an Apple device', () => {
    const s = sub({ plan: 'active', plan_source: 'apple' })
    expect(billingDestination(s, { onAppleDevice: false })).toBe('apple-web')
  })

  it('treats an unknown source as Stripe rather than guessing Apple', () => {
    // Rows predating the plan_source column: Stripe is the safe assumption,
    // since Apple billing only ever existed after the column did.
    const s = sub({ plan: 'active', plan_source: null })
    expect(billingDestination(s, { onAppleDevice: true })).toBe('stripe')
  })

  it('does not route a plan-less account to Apple just because it is on iOS', () => {
    expect(billingDestination(sub({ plan: 'none', plan_source: 'apple' }), { onAppleDevice: true }))
      .toBe('stripe')
  })
})

describe('hasBillingRelationship', () => {
  it('is false during the app-managed trial, which has no card at either store', () => {
    expect(hasBillingRelationship(sub({ plan: 'trialing', plan_source: null }))).toBe(false)
  })

  it('is true for a trial that already has a payment source attached', () => {
    expect(hasBillingRelationship(sub({ plan: 'trialing', plan_source: 'stripe' }))).toBe(true)
  })

  it('is true for a legacy subscription with no recorded source', () => {
    // Must not hide the portal from a real subscriber whose row predates the
    // plan_source column — that would strip their only way to cancel.
    expect(hasBillingRelationship(sub({ plan: 'active', plan_source: null }))).toBe(true)
    expect(hasBillingRelationship(sub({ plan: 'past_due', plan_source: null }))).toBe(true)
  })

  it('is false with no subscription at all', () => {
    expect(hasBillingRelationship(null)).toBe(false)
    expect(hasBillingRelationship(sub({ plan: 'none' }))).toBe(false)
  })
})
