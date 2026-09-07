import { describe, it, expect } from 'vitest'
import { shouldApplyUpdate, type CurrentPlanRow, type SubscriptionUpdate } from './updateSubscription'
import { GRACE_DAYS } from './entitlement'

const NOW = Date.parse('2026-08-01T12:00:00.000Z')
const DAY = 86_400_000
const at = (days: number) => new Date(NOW + days * DAY).toISOString()

function row(overrides: Partial<CurrentPlanRow> = {}): CurrentPlanRow {
  return {
    plan: 'active',
    plan_source: 'stripe',
    trial_ends_at: null,
    plan_expires_at: null,
    ...overrides,
  }
}

function update(overrides: Partial<SubscriptionUpdate> = {}): SubscriptionUpdate {
  return { plan: 'active', source: 'stripe', ...overrides }
}

const apply = (current: CurrentPlanRow | null, u: SubscriptionUpdate) =>
  shouldApplyUpdate(current, u, NOW)

describe('shouldApplyUpdate — same store', () => {
  it('always applies a write from the store that already owns the row', () => {
    // Each store is the sole authority on its own subscription, including
    // revoking it. No guard may ever get in the way of that.
    for (const plan of ['none', 'trialing', 'active', 'cancelled', 'past_due'] as const) {
      expect(apply(row({ plan_source: 'stripe' }), update({ plan, source: 'stripe' }))).toBe(true)
      expect(apply(row({ plan_source: 'apple' }), update({ plan, source: 'apple' }))).toBe(true)
    }
  })

  it('applies to a row with no recorded source, and to a row that does not exist', () => {
    expect(apply(row({ plan_source: null }), update({ plan: 'cancelled', source: 'apple' }))).toBe(
      true,
    )
    expect(apply(null, update({ plan: 'cancelled', source: 'apple' }))).toBe(true)
  })
})

describe('shouldApplyUpdate — cancel on Stripe, resubscribe on Apple', () => {
  // The headline scenario, and the reason this guard exists.
  //
  // Stripe does not fire `customer.subscription.deleted` when the user clicks
  // cancel — it fires at the end of the period they already paid for, which can
  // be a month later. If they bought on the App Store in the meantime, that late
  // event still matches the row by stripe_customer_id (which we never clear, and
  // shouldn't). Unguarded it stamps cancelled/stripe over a live, paying App
  // Store subscription and drops the customer onto the paywall.
  const liveApple = row({ plan: 'active', plan_source: 'apple', plan_expires_at: at(20) })

  it('drops the late Stripe cancellation instead of revoking the Apple plan', () => {
    expect(apply(liveApple, update({ plan: 'cancelled', source: 'stripe' }))).toBe(false)
  })

  it('drops a late Stripe payment failure too', () => {
    // Same shape: the old card fails on a subscription they already left.
    expect(
      apply(liveApple, update({ plan: 'past_due', source: 'stripe', plan_expires_at: at(0) })),
    ).toBe(false)
  })

  it('protects an Apple trial and an Apple plan inside its grace window', () => {
    expect(
      apply(
        row({ plan: 'trialing', plan_source: 'apple', trial_ends_at: at(5) }),
        update({ plan: 'cancelled', source: 'stripe' }),
      ),
    ).toBe(false)
    expect(
      apply(
        row({ plan: 'active', plan_source: 'apple', plan_expires_at: at(-1) }),
        update({ plan: 'cancelled', source: 'stripe' }),
      ),
    ).toBe(false)
  })
})

describe('shouldApplyUpdate — cancel on Apple, resubscribe on Stripe', () => {
  // The mirror image, equally real: an Apple EXPIRED notification arriving after
  // the user moved to Stripe still matches on apple_original_txn, which we also
  // never clear.
  const liveStripe = row({ plan: 'active', plan_source: 'stripe' })

  it('drops the late Apple expiry instead of revoking the Stripe plan', () => {
    expect(apply(liveStripe, update({ plan: 'cancelled', source: 'apple' }))).toBe(false)
  })

  it('drops a late Apple billing-retry notification too', () => {
    expect(
      apply(liveStripe, update({ plan: 'past_due', source: 'apple', plan_expires_at: at(-1) })),
    ).toBe(false)
  })
})

describe('shouldApplyUpdate — a genuine move between stores', () => {
  it('lets an entitling write from the new store take over immediately', () => {
    // Money just changed hands at the new store; it is now the source of truth.
    // Blocking this would leave a paying customer looking at a paywall.
    expect(
      apply(
        row({ plan: 'active', plan_source: 'stripe' }),
        update({ plan: 'active', source: 'apple', plan_expires_at: at(30) }),
      ),
    ).toBe(true)
    expect(
      apply(
        row({ plan: 'active', plan_source: 'apple', plan_expires_at: at(30) }),
        update({ plan: 'active', source: 'stripe' }),
      ),
    ).toBe(true)
  })

  it('lets a trial from the other store take over', () => {
    expect(
      apply(
        row({ plan: 'active', plan_source: 'stripe' }),
        update({ plan: 'trialing', source: 'apple', trial_ends_at: at(14) }),
      ),
    ).toBe(true)
  })

  it('applies a revoking write once the other store is no longer entitled', () => {
    // Nothing left to protect, and it keeps the recorded source honest so
    // "Manage billing" points at the store that actually holds the history.
    expect(
      apply(
        row({ plan: 'cancelled', plan_source: 'apple' }),
        update({ plan: 'cancelled', source: 'stripe' }),
      ),
    ).toBe(true)
    expect(
      apply(
        row({ plan: 'active', plan_source: 'apple', plan_expires_at: at(-GRACE_DAYS - 1) }),
        update({ plan: 'cancelled', source: 'stripe' }),
      ),
    ).toBe(true)
  })
})

describe('shouldApplyUpdate — partial writes', () => {
  // `undefined` means "leave this column alone", so the incoming state has to
  // inherit the current value. Reading an absent field as null would misjudge a
  // renewal that only mentions `plan` as an expiry-less grant — and, worse,
  // could let a bare `plan: 'active'` from the wrong store slip through as
  // entitling when the row it inherits is long expired.
  it('inherits the current expiry when the update omits it', () => {
    const expiredApple = row({
      plan: 'active',
      plan_source: 'apple',
      plan_expires_at: at(-GRACE_DAYS - 1),
    })
    // Inherited expiry is stale → the incoming write is not entitling → and the
    // current row is not entitled either → so it applies (rule 4), rather than
    // being mistaken for a live grant.
    expect(apply(expiredApple, update({ plan: 'active', source: 'stripe' }))).toBe(true)
  })

  it('inherits the current trial end when the update omits it', () => {
    const liveAppleTrial = row({
      plan: 'trialing',
      plan_source: 'apple',
      trial_ends_at: at(5),
    })
    // A Stripe write of `trialing` with no dates inherits the live trial end and
    // therefore counts as entitling — a real store switch, not a stale event.
    expect(apply(liveAppleTrial, update({ plan: 'trialing', source: 'stripe' }))).toBe(true)
  })

  it('respects an explicit null as a clear, not as "leave alone"', () => {
    const liveApple = row({ plan: 'active', plan_source: 'apple', plan_expires_at: at(20) })
    // Explicitly clearing the trial end alongside a cancellation is still a
    // revoking write from the wrong store, so it is still dropped.
    expect(
      apply(liveApple, update({ plan: 'cancelled', source: 'stripe', trial_ends_at: null })),
    ).toBe(false)
  })
})

describe('shouldApplyUpdate — ordering independence', () => {
  // Neither store guarantees delivery order and both warn about duplicates, so
  // the guard is deliberately blind to timestamps: replaying the same stale
  // event any number of times must never change the answer.
  it('is idempotent under repeated stale deliveries', () => {
    const liveApple = row({ plan: 'active', plan_source: 'apple', plan_expires_at: at(20) })
    const stale = update({ plan: 'cancelled', source: 'stripe' })
    for (let i = 0; i < 5; i++) expect(apply(liveApple, stale)).toBe(false)
  })
})
