// End-to-end subscription journeys.
//
// The unit suites prove each rule in isolation. This one replays real sequences
// of store events against a profile row and asserts what the user actually sees
// at every step — entitlement, and which buttons the paywall offers. It exists
// because every subscription bug this codebase has had was a *sequence* bug: a
// single event handled correctly, arriving at the wrong moment.
//
// `step()` mirrors the database exactly: shouldApplyUpdate() decides whether the
// write lands, and updateColumns() supplies the same partial merge Postgres
// applies on UPDATE. No behaviour is re-implemented here.

import { describe, it, expect } from 'vitest'
import {
  shouldApplyUpdate,
  updateColumns,
  type CurrentPlanRow,
  type SubscriptionUpdate,
} from './updateSubscription'
import { isEntitled, GRACE_DAYS } from './entitlement'
import {
  purchaseRoute,
  billingDestination,
  hasBillingRelationship,
  type Subscription,
} from '../../src/lib/subscription'

const NOW = Date.parse('2026-08-01T12:00:00.000Z')
const DAY = 86_400_000
const at = (days: number) => new Date(NOW + days * DAY).toISOString()

/** A profile row as it exists before anyone has paid: the app-managed 14-day
 *  reverse trial granted by /api/profile/ensure. No card, no store. */
const FRESH_TRIAL: CurrentPlanRow = {
  plan: 'trialing',
  plan_source: null,
  trial_ends_at: at(14),
  plan_expires_at: null,
}

const NO_PLAN: CurrentPlanRow = {
  plan: 'none',
  plan_source: null,
  trial_ends_at: null,
  plan_expires_at: null,
}

/** Apply one store event, exactly as the webhook handlers would. */
function step(row: CurrentPlanRow, update: SubscriptionUpdate): CurrentPlanRow {
  if (!shouldApplyUpdate(row, update, NOW)) return row
  return { ...row, ...updateColumns(update) } as CurrentPlanRow
}

/** What the client would hold for this row. */
function asSubscription(row: CurrentPlanRow): Subscription {
  return { ...row, onboarded_at: at(-1), featureFlags: [] }
}

/** Everything the user's experience actually turns on, in one object. */
function view(row: CurrentPlanRow, { onAppleDevice }: { onAppleDevice: boolean }) {
  const sub = asSubscription(row)
  return {
    entitled: isEntitled(row, NOW),
    buy: purchaseRoute(sub, { onAppleDevice }),
    manage: hasBillingRelationship(sub)
      ? billingDestination(sub, { onAppleDevice })
      : 'no-portal',
  }
}

const WEB = { onAppleDevice: false }
const IOS = { onAppleDevice: true }

// ── Store events, in each store's own vocabulary ─────────────────────────────

const stripe = {
  checkoutCompleted: (): SubscriptionUpdate => ({
    plan: 'active',
    source: 'stripe',
    trial_ends_at: null,
    plan_expires_at: at(30),
    stripe_customer_id: 'cus_1',
  }),
  /** Cancel-at-period-end: status stays `active`, so nothing lapses yet. */
  cancelScheduled: (): SubscriptionUpdate => ({
    plan: 'active',
    source: 'stripe',
    plan_expires_at: at(30),
  }),
  /** `customer.subscription.deleted` — fires only at period end. */
  deleted: (whenDays: number): SubscriptionUpdate => ({
    plan: 'cancelled',
    source: 'stripe',
    plan_expires_at: at(whenDays),
  }),
  paymentFailed: (whenDays: number): SubscriptionUpdate => ({
    plan: 'past_due',
    source: 'stripe',
    plan_expires_at: at(whenDays),
  }),
  renewed: (): SubscriptionUpdate => ({
    plan: 'active',
    source: 'stripe',
    plan_expires_at: at(30),
  }),
}

const apple = {
  purchased: (): SubscriptionUpdate => ({
    plan: 'active',
    source: 'apple',
    trial_ends_at: null,
    plan_expires_at: at(30),
    apple_original_txn: 'txn_1',
  }),
  /** Apple's EXPIRED / REVOKED → our `cancelled`. */
  expired: (whenDays: number): SubscriptionUpdate => ({
    plan: 'cancelled',
    source: 'apple',
    plan_expires_at: at(whenDays),
    apple_original_txn: 'txn_1',
  }),
  /** BILLING_RETRY — Apple couldn't charge and is still retrying. */
  billingRetry: (whenDays: number): SubscriptionUpdate => ({
    plan: 'past_due',
    source: 'apple',
    plan_expires_at: at(whenDays),
    apple_original_txn: 'txn_1',
  }),
  renewed: (): SubscriptionUpdate => ({
    plan: 'active',
    source: 'apple',
    plan_expires_at: at(60),
    apple_original_txn: 'txn_1',
  }),
}

// ── Journeys ─────────────────────────────────────────────────────────────────

describe('journey: the app-managed trial', () => {
  it('unlocks the journal with no card and offers no portal', () => {
    expect(view(FRESH_TRIAL, WEB)).toEqual({
      entitled: true,
      buy: 'stripe',
      // No card at either store yet, so a portal link would 404 on both paths.
      manage: 'no-portal',
    })
    expect(view(FRESH_TRIAL, IOS).buy).toBe('apple-iap')
  })

  it('locks the moment the trial date passes, with no grace', () => {
    const expired = { ...FRESH_TRIAL, trial_ends_at: at(-0.001) }
    expect(view(expired, WEB)).toEqual({ entitled: false, buy: 'stripe', manage: 'no-portal' })
  })

  it('converts to a paid Stripe plan without a gap', () => {
    const paid = step(FRESH_TRIAL, stripe.checkoutCompleted())
    expect(view(paid, WEB)).toEqual({ entitled: true, buy: 'stripe', manage: 'stripe' })
  })
})

describe('journey: cancel on Stripe, resubscribe on the App Store', () => {
  // The headline scenario. What makes it dangerous is the ordering: Stripe's
  // `customer.subscription.deleted` fires at the END of the paid period, which
  // can be weeks after the user has already moved to Apple.
  it('keeps the paying App Store subscriber unlocked when the late Stripe cancel lands', () => {
    let row = step(FRESH_TRIAL, stripe.checkoutCompleted())
    row = step(row, stripe.cancelScheduled())
    // Still paid up — cancelling on Stripe does not end access immediately.
    expect(isEntitled(row, NOW)).toBe(true)

    // They buy on the App Store before the Stripe period runs out.
    row = step(row, apple.purchased())
    expect(view(row, IOS)).toEqual({ entitled: true, buy: 'apple-iap', manage: 'apple-native' })

    // Weeks later, the Stripe period ends and `.deleted` finally arrives.
    row = step(row, stripe.deleted(0))

    // Unguarded, this is the paywall bug: cancelled/stripe stamped over a live,
    // paying App Store subscription.
    expect(row.plan).toBe('active')
    expect(row.plan_source).toBe('apple')
    expect(view(row, IOS)).toEqual({ entitled: true, buy: 'apple-iap', manage: 'apple-native' })
    // And the same subscription entitles them on the web, billed by Apple.
    expect(view(row, WEB)).toEqual({
      entitled: true,
      buy: 'apple-elsewhere',
      manage: 'apple-web',
    })
  })

  it('survives the late Stripe events arriving out of order and duplicated', () => {
    let row = step(step(FRESH_TRIAL, stripe.checkoutCompleted()), apple.purchased())
    for (const event of [stripe.deleted(0), stripe.paymentFailed(0), stripe.deleted(-1)]) {
      row = step(row, event)
      row = step(row, event) // duplicate delivery, which Apple and Stripe both warn about
    }
    expect(view(row, IOS)).toEqual({ entitled: true, buy: 'apple-iap', manage: 'apple-native' })
  })

  it('still lets Apple cancel its own subscription afterwards', () => {
    // The guard must never make a subscription un-cancellable.
    let row = step(step(FRESH_TRIAL, stripe.checkoutCompleted()), apple.purchased())
    row = step(row, stripe.deleted(0))
    row = step(row, apple.expired(0))
    expect(row.plan).toBe('cancelled')
    expect(view(row, WEB)).toEqual({
      entitled: false,
      // Apple is done with them, so the web must be able to take payment again.
      buy: 'stripe',
      // …while the old subscription is still managed where it was bought.
      manage: 'apple-web',
    })
  })
})

describe('journey: cancel on the App Store, resubscribe on the web', () => {
  it('does not let a late Apple expiry revoke the new Stripe plan', () => {
    let row = step(FRESH_TRIAL, apple.purchased())
    row = step(row, apple.expired(0))
    expect(isEntitled(row, NOW)).toBe(false)

    // They subscribe again from a browser — the path that used to be blocked.
    expect(purchaseRoute(asSubscription(row), WEB)).toBe('stripe')
    row = step(row, stripe.checkoutCompleted())
    expect(view(row, WEB)).toEqual({ entitled: true, buy: 'stripe', manage: 'stripe' })

    // A straggling Apple notification about the dead subscription arrives.
    row = step(row, apple.expired(-1))
    expect(view(row, WEB)).toEqual({ entitled: true, buy: 'stripe', manage: 'stripe' })
  })

  it('never strands someone whose App Store subscription expired', () => {
    // The dead end: `plan_source === 'apple'` alone used to hide Stripe
    // checkout forever, telling them to renew on an iPhone they may have sold,
    // while /api/stripe/checkout would happily have taken the payment.
    const lapsed = step(step(FRESH_TRIAL, apple.purchased()), apple.expired(0))
    expect(view(lapsed, WEB).buy).toBe('stripe')
  })
})

describe('journey: a card fails', () => {
  it('keeps the journal open through the dunning window, then closes it', () => {
    let row = step(FRESH_TRIAL, stripe.checkoutCompleted())
    row = step(row, stripe.paymentFailed(0))

    // Locking someone out the hour a card expires — while Stripe is still
    // retrying it — is both unkind and bad business.
    expect(view(row, WEB)).toEqual({ entitled: true, buy: 'stripe', manage: 'stripe' })

    const afterGrace = { ...row, plan_expires_at: at(-GRACE_DAYS) }
    expect(view(afterGrace, WEB).entitled).toBe(false)
    // Still routed to Stripe to fix the card, not to the App Store.
    expect(view(afterGrace, IOS).manage).toBe('stripe')
  })

  it('reopens when the retry succeeds', () => {
    let row = step(step(FRESH_TRIAL, stripe.checkoutCompleted()), stripe.paymentFailed(0))
    row = step(row, stripe.renewed())
    expect(view(row, WEB)).toEqual({ entitled: true, buy: 'stripe', manage: 'stripe' })
  })

  it('withholds Stripe checkout while Apple is still retrying the card', () => {
    // Apple's BILLING_RETRY runs for up to 60 days. Selling them a Stripe
    // subscription in that window is a double charge nobody can refund — and
    // their real fix (update the payment method at Apple) works in any browser.
    const retrying = step(step(FRESH_TRIAL, apple.purchased()), apple.billingRetry(-GRACE_DAYS))
    expect(view(retrying, WEB)).toEqual({
      entitled: false,
      buy: 'apple-elsewhere',
      manage: 'apple-web',
    })
  })
})

describe('journey: a webhook never arrives', () => {
  it('lapses an active plan that sits past its renewal date', () => {
    // Otherwise one dropped renewal notification is free access forever.
    const stale = { ...step(FRESH_TRIAL, apple.purchased()), plan_expires_at: at(-GRACE_DAYS) }
    expect(isEntitled(stale, NOW)).toBe(false)
  })

  it('does not lapse a healthy Stripe plan that records no expiry', () => {
    const row = { ...step(FRESH_TRIAL, stripe.checkoutCompleted()), plan_expires_at: null }
    expect(isEntitled(row, NOW)).toBe(true)
  })

  it('self-heals when the renewal finally lands', () => {
    let row: CurrentPlanRow = {
      ...step(FRESH_TRIAL, apple.purchased()),
      plan_expires_at: at(-GRACE_DAYS),
    }
    expect(isEntitled(row, NOW)).toBe(false)
    row = step(row, apple.renewed())
    expect(view(row, IOS)).toEqual({ entitled: true, buy: 'apple-iap', manage: 'apple-native' })
  })
})

describe('journey: a brand-new account with no plan at all', () => {
  it('can buy on either platform and is offered no portal', () => {
    expect(view(NO_PLAN, WEB)).toEqual({ entitled: false, buy: 'stripe', manage: 'no-portal' })
    expect(view(NO_PLAN, IOS)).toEqual({ entitled: false, buy: 'apple-iap', manage: 'no-portal' })
  })
})

describe('invariant: nobody is ever locked out with nothing to press', () => {
  // The failure mode worth naming: not entitled, no way to pay, no way to
  // manage. Sweep every reachable row shape and assert there is always a door.
  const ROWS: CurrentPlanRow[] = [
    NO_PLAN,
    FRESH_TRIAL,
    { ...FRESH_TRIAL, trial_ends_at: at(-1) },
    step(FRESH_TRIAL, stripe.checkoutCompleted()),
    step(FRESH_TRIAL, apple.purchased()),
    step(step(FRESH_TRIAL, stripe.checkoutCompleted()), stripe.deleted(0)),
    step(step(FRESH_TRIAL, apple.purchased()), apple.expired(0)),
    step(step(FRESH_TRIAL, stripe.checkoutCompleted()), stripe.paymentFailed(-GRACE_DAYS)),
    step(step(FRESH_TRIAL, apple.purchased()), apple.billingRetry(-GRACE_DAYS)),
  ]

  for (const device of [WEB, IOS]) {
    for (const row of ROWS) {
      const label = `${row.plan}/${row.plan_source ?? 'null'} on ${device.onAppleDevice ? 'iOS' : 'web'}`
      it(label, () => {
        const v = view(row, device)
        if (v.entitled) return

        // Either they can buy right here, or we can point them at the store
        // that is holding them — never neither.
        const canBuy = v.buy === 'stripe' || v.buy === 'apple-iap'
        const canManage = v.manage !== 'no-portal'
        expect(canBuy || canManage).toBe(true)

        // And whenever we withhold purchase, the manage route must reach Apple,
        // because that is the only place the block can be resolved.
        if (v.buy === 'apple-elsewhere') {
          expect(v.manage).toBe('apple-web')
        }
      })
    }
  }
})
