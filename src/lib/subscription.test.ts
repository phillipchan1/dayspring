import { describe, it, expect, beforeEach } from 'vitest'
import {
  isEntitled,
  isAppleManaged,
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
