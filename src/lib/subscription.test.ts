import { describe, it, expect, beforeEach } from 'vitest'
import {
  isEntitled,
  appleMayStillCharge,
  isAppleRelationship,
  billingDestination,
  purchaseRoute,
  hasBillingRelationship,
  readCachedSubscription,
  writeCachedSubscription,
  trialDaysRemaining,
  GRACE_DAYS,
  SUBSCRIPTION_CACHE_KEY,
  type Plan,
  type PlanSource,
  type Subscription,
} from './subscription'

const NOW = Date.parse('2026-08-01T12:00:00.000Z')
const DAY = 86_400_000

function at(offsetDays: number): string {
  return new Date(NOW + offsetDays * DAY).toISOString()
}

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
    expect(isEntitled(sub({ plan: 'active', plan_source: 'stripe' }), NOW)).toBe(true)
    expect(isEntitled(sub({ plan: 'active', plan_source: 'apple' }), NOW)).toBe(true)
  })

  it('entitles a trial only while it is still running, with no grace', () => {
    expect(isEntitled(sub({ plan: 'trialing', trial_ends_at: at(1) }), NOW)).toBe(true)
    expect(isEntitled(sub({ plan: 'trialing', trial_ends_at: at(-0.001) }), NOW)).toBe(false)
    // A trial's whole contract is its end date — it must not inherit the
    // dropped-webhook grace that `active` and `past_due` get.
    expect(isEntitled(sub({ plan: 'trialing', trial_ends_at: at(-1) }), NOW)).toBe(false)
  })

  it('does not entitle a trial with no recorded end date', () => {
    expect(isEntitled(sub({ plan: 'trialing', trial_ends_at: null }), NOW)).toBe(false)
  })

  it('does not entitle cancelled or absent plans', () => {
    expect(isEntitled(sub({ plan: 'cancelled' }), NOW)).toBe(false)
    expect(isEntitled(sub({ plan: 'none' }), NOW)).toBe(false)
    expect(isEntitled(null, NOW)).toBe(false)
  })

  describe('dropped-renewal backstop', () => {
    // An `active` row sitting past its renewal date means we never heard the
    // renewal. Grace it, then lapse it — otherwise one lost webhook grants
    // free access forever.
    it('keeps an active plan entitled up to the grace boundary', () => {
      expect(isEntitled(sub({ plan: 'active', plan_expires_at: at(1) }), NOW)).toBe(true)
      expect(isEntitled(sub({ plan: 'active', plan_expires_at: at(-0.5) }), NOW)).toBe(true)
      expect(
        isEntitled(sub({ plan: 'active', plan_expires_at: at(-GRACE_DAYS + 0.5) }), NOW),
      ).toBe(true)
    })

    it('lapses an active plan once the grace window closes', () => {
      expect(isEntitled(sub({ plan: 'active', plan_expires_at: at(-GRACE_DAYS) }), NOW)).toBe(false)
      expect(isEntitled(sub({ plan: 'active', plan_expires_at: at(-30) }), NOW)).toBe(false)
    })

    it('entitles an active plan with no expiry — the healthy Stripe shape', () => {
      expect(isEntitled(sub({ plan: 'active', plan_expires_at: null }), NOW)).toBe(true)
    })

    it('fails open on an unparseable expiry rather than locking someone out', () => {
      expect(isEntitled(sub({ plan: 'active', plan_expires_at: 'not-a-date' }), NOW)).toBe(true)
    })
  })

  describe('dunning grace', () => {
    // past_due is the start of collection, not the end of the relationship.
    // Stripe retries for days; evicting someone from their own journal the hour
    // a card expires is both unkind and bad business.
    it('keeps a past_due plan entitled inside the grace window', () => {
      expect(isEntitled(sub({ plan: 'past_due', plan_expires_at: at(-1) }), NOW)).toBe(true)
    })

    it('lapses a past_due plan once grace runs out', () => {
      expect(isEntitled(sub({ plan: 'past_due', plan_expires_at: at(-GRACE_DAYS) }), NOW)).toBe(
        false,
      )
    })

    it('gives no grace to a past_due row with no failure timestamp', () => {
      // Rows written before we recorded the moment billing failed get the old
      // behaviour rather than an unbounded free ride.
      expect(isEntitled(sub({ plan: 'past_due', plan_expires_at: null }), NOW)).toBe(false)
    })
  })
})

describe('appleMayStillCharge', () => {
  // The guard that keeps Stripe checkout away from someone Apple is also
  // billing. A false negative here is a double charge neither store will refund.
  it('is true while Apple can still take money — including billing retry', () => {
    for (const plan of ['active', 'trialing', 'past_due'] as const) {
      expect(appleMayStillCharge(sub({ plan, plan_source: 'apple' }))).toBe(true)
    }
  })

  it('is false once the App Store subscription has genuinely ended', () => {
    // The regression that stranded people: a cancelled App Store subscriber was
    // told to renew on an iPhone they may no longer own, and could never pay
    // again from a browser — while the server would have taken the money.
    expect(appleMayStillCharge(sub({ plan: 'cancelled', plan_source: 'apple' }))).toBe(false)
    expect(appleMayStillCharge(sub({ plan: 'none', plan_source: 'apple' }))).toBe(false)
  })

  it('is false for Stripe-sourced and source-less plans', () => {
    expect(appleMayStillCharge(sub({ plan: 'active', plan_source: 'stripe' }))).toBe(false)
    expect(appleMayStillCharge(sub({ plan: 'active', plan_source: null }))).toBe(false)
    expect(appleMayStillCharge(null)).toBe(false)
  })
})

describe('isAppleRelationship', () => {
  it('survives cancellation — a lapsed App Store sub is still managed at Apple', () => {
    for (const plan of ['active', 'trialing', 'past_due', 'cancelled'] as const) {
      expect(isAppleRelationship(sub({ plan, plan_source: 'apple' }))).toBe(true)
    }
  })

  it('is false with no plan and for non-Apple sources', () => {
    expect(isAppleRelationship(sub({ plan: 'none', plan_source: 'apple' }))).toBe(false)
    expect(isAppleRelationship(sub({ plan: 'active', plan_source: 'stripe' }))).toBe(false)
    expect(isAppleRelationship(null)).toBe(false)
  })
})

describe('purchaseRoute', () => {
  it('always uses StoreKit on an Apple device', () => {
    // App Store rules: digital goods on iOS go through IAP, whatever billed
    // this account before. A Stripe checkout here is a rejection.
    for (const source of ['stripe', 'apple', null] as const) {
      for (const plan of ['none', 'cancelled', 'past_due'] as Plan[]) {
        expect(purchaseRoute(sub({ plan, plan_source: source }), { onAppleDevice: true })).toBe(
          'apple-iap',
        )
      }
    }
  })

  it('sends a lapsed App Store subscriber to Stripe on the web', () => {
    // The dead end this function exists to remove.
    expect(
      purchaseRoute(sub({ plan: 'cancelled', plan_source: 'apple' }), { onAppleDevice: false }),
    ).toBe('stripe')
  })

  it('withholds Stripe while Apple may still charge', () => {
    for (const plan of ['active', 'trialing', 'past_due'] as const) {
      expect(purchaseRoute(sub({ plan, plan_source: 'apple' }), { onAppleDevice: false })).toBe(
        'apple-elsewhere',
      )
    }
  })

  it('sends everyone else on the web to Stripe', () => {
    expect(
      purchaseRoute(sub({ plan: 'cancelled', plan_source: 'stripe' }), { onAppleDevice: false }),
    ).toBe('stripe')
    expect(purchaseRoute(null, { onAppleDevice: false })).toBe('stripe')
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

  it('still points a cancelled Apple subscriber at Apple', () => {
    // Management follows the relationship, not entitlement — a lapsed App Store
    // subscription is only visible (and only refundable) in the App Store.
    const s = sub({ plan: 'cancelled', plan_source: 'apple' })
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

describe('purchase and management never contradict each other', () => {
  // The invariant behind the whole split: whenever we withhold a Stripe purchase
  // because Apple may still charge, "Manage billing" must be pointing at Apple —
  // otherwise we block the only payment path AND hide the fix, which is exactly
  // how someone ends up locked out with no button to press.
  const PLANS: Plan[] = ['none', 'trialing', 'active', 'cancelled', 'past_due']
  const SOURCES: (PlanSource | null)[] = ['stripe', 'apple', null]

  for (const plan of PLANS) {
    for (const source of SOURCES) {
      it(`plan=${plan} source=${source ?? 'null'}`, () => {
        const s = sub({ plan, plan_source: source, trial_ends_at: at(3) })
        if (purchaseRoute(s, { onAppleDevice: false }) === 'apple-elsewhere') {
          expect(billingDestination(s, { onAppleDevice: false })).toBe('apple-web')
          expect(hasBillingRelationship(s)).toBe(true)
        }
      })
    }
  }
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

describe('trialDaysRemaining', () => {
  // Reads the wall clock rather than the pinned NOW, so these offsets are real.
  const fromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

  it('rounds up so the last partial day still reads as a day', () => {
    expect(trialDaysRemaining(sub({ trial_ends_at: fromNow(0.1) }))).toBe(1)
  })

  it('never goes negative', () => {
    expect(trialDaysRemaining(sub({ trial_ends_at: fromNow(-5) }))).toBe(0)
    expect(trialDaysRemaining(sub({ trial_ends_at: null }))).toBe(0)
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
    // the missing key surfaced as `undefined`, the Apple checks would still read
    // false — but any `plan_source === undefined` comparison downstream would
    // be a silent landmine. Normalise once, here.
    localStorage.setItem(
      SUBSCRIPTION_CACHE_KEY,
      JSON.stringify({ plan: 'active', trial_ends_at: null, plan_expires_at: null, onboarded_at: null, featureFlags: [] }),
    )
    const cached = readCachedSubscription()
    expect(cached?.plan_source).toBeNull()
    expect(appleMayStillCharge(cached)).toBe(false)
    expect(isAppleRelationship(cached)).toBe(false)
  })

  it('returns null on absent or corrupt cache rather than throwing', () => {
    expect(readCachedSubscription()).toBeNull()
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, '{not json')
    expect(readCachedSubscription()).toBeNull()
  })

  it('does not let a stale cached entitlement outlive its own expiry', () => {
    // The cache paints the app instantly on launch, before the server answers.
    // If it could grant entitlement past the expiry it recorded, an offline
    // device would be a free-forever device.
    writeCachedSubscription(sub({ plan: 'active', plan_expires_at: at(-30) }))
    expect(isEntitled(readCachedSubscription(), NOW)).toBe(false)
  })
})
