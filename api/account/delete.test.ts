// Deleting an account is the one action with no undo, and the one place where
// getting a subscription wrong costs the user money rather than a re-sync. Both
// halves of that are decided by `planAccountDeletion`, so both are pinned here:
// who is blocked, and whose card we have to stop first.

import { describe, expect, it } from 'vitest'
import { attachmentKeysFor, planAccountDeletion, type DeletionSubject } from './delete.js'

const CUSTOMER = 'cus_123'

/** The default is the app-managed trial: no store, no card, nothing to cancel. */
function subject(over: Partial<DeletionSubject> = {}): DeletionSubject {
  return { plan: 'trialing', plan_source: null, trial_ends_at: '2099-01-01T00:00:00Z', ...over }
}

describe('planAccountDeletion', () => {
  it('lets someone on the app-managed trial go, with nothing to cancel', () => {
    expect(planAccountDeletion(subject(), null)).toEqual({
      allowed: true,
      cancelStripeFor: null,
    })
  })

  it('lets an account with no plan at all go', () => {
    expect(planAccountDeletion(subject({ plan: 'none' }), null)).toEqual({
      allowed: true,
      cancelStripeFor: null,
    })
  })

  it('lets a profile we could not read go', () => {
    expect(planAccountDeletion(null, null)).toEqual({ allowed: true, cancelStripeFor: null })
  })

  it('cancels a live Stripe subscription on the way out', () => {
    const plan = planAccountDeletion(
      subject({ plan: 'active', plan_source: 'stripe', stripe_customer_id: CUSTOMER }),
      null,
    )
    expect(plan).toEqual({ allowed: true, cancelStripeFor: CUSTOMER })
  })

  it('cancels a Stripe subscription that is mid-dunning', () => {
    const plan = planAccountDeletion(
      subject({ plan: 'past_due', plan_source: 'stripe', stripe_customer_id: CUSTOMER }),
      null,
    )
    expect(plan).toEqual({ allowed: true, cancelStripeFor: CUSTOMER })
  })

  it('still sweeps Stripe for a cancelled row, in case the row is behind', () => {
    const plan = planAccountDeletion(
      subject({ plan: 'cancelled', plan_source: 'stripe', stripe_customer_id: CUSTOMER }),
      null,
    )
    expect(plan).toEqual({ allowed: true, cancelStripeFor: CUSTOMER })
  })

  it('sweeps a Stripe customer left behind by someone now on the trial', () => {
    // stripe_customer_id is never cleared — it is how they reach the portal for
    // a refund. So its presence, not plan_source, is what says "look here".
    const plan = planAccountDeletion(subject({ stripe_customer_id: CUSTOMER }), null)
    expect(plan).toEqual({ allowed: true, cancelStripeFor: CUSTOMER })
  })

  it('sweeps Stripe even when the profile says the account is billed by Apple', () => {
    // The cross-store guard lets plan_source point at Apple while an older
    // Stripe subscription is still live. Missing it would keep charging them.
    const plan = planAccountDeletion(
      subject({
        plan: 'cancelled',
        plan_source: 'apple',
        stripe_customer_id: CUSTOMER,
      }),
      null,
    )
    expect(plan).toEqual({ allowed: true, cancelStripeFor: CUSTOMER })
  })

  it('refuses while the App Store is still set to renew', () => {
    const plan = planAccountDeletion(
      subject({ plan: 'active', plan_source: 'apple', plan_expires_at: '2099-01-01T00:00:00Z' }),
      true,
    )
    expect(plan.allowed).toBe(false)
    if (plan.allowed) return
    expect(plan.blockedBy).toBe('apple-will-renew')
    expect(plan.message).toContain('App Store')
  })

  it('lets an App Store subscriber go once they have turned renewal off', () => {
    // The case that makes the live Apple read worth its round trip: the plan
    // stays `active` until the paid period ends, which for an annual
    // subscription is up to a year of being unable to delete your own account.
    const plan = planAccountDeletion(
      subject({ plan: 'active', plan_source: 'apple', plan_expires_at: '2099-01-01T00:00:00Z' }),
      false,
    )
    expect(plan).toEqual({ allowed: true, cancelStripeFor: null })
  })

  it('refuses while Apple is retrying a failed card', () => {
    // BILLING_RETRY: not entitled, but Apple keeps trying the card for up to 60
    // days. Entitlement and "might still charge you" are different questions.
    const plan = planAccountDeletion(
      subject({ plan: 'past_due', plan_source: 'apple', plan_expires_at: '2000-01-01T00:00:00Z' }),
      true,
    )
    expect(plan.allowed).toBe(false)
    if (plan.allowed) return
    expect(plan.blockedBy).toBe('apple-will-renew')
  })

  it('refuses when Apple would not tell us whether it will renew', () => {
    const plan = planAccountDeletion(
      subject({ plan: 'active', plan_source: 'apple', plan_expires_at: '2099-01-01T00:00:00Z' }),
      null,
    )
    expect(plan.allowed).toBe(false)
    if (plan.allowed) return
    expect(plan.blockedBy).toBe('apple-unknown')
    expect(plan.message).toContain('try again')
  })

  it('does not ask Apple about a subscription Apple has already ended', () => {
    // `cancelled` from Apple means EXPIRED or REVOKED — genuinely over. Nothing
    // to block on, whatever the live lookup would have said.
    const plan = planAccountDeletion(subject({ plan: 'cancelled', plan_source: 'apple' }), null)
    expect(plan).toEqual({ allowed: true, cancelStripeFor: null })
  })

  it('never blocks a Stripe account, however lapsed', () => {
    for (const plan of ['none', 'trialing', 'active', 'cancelled', 'past_due'] as const) {
      const decision = planAccountDeletion(
        subject({ plan, plan_source: 'stripe', stripe_customer_id: CUSTOMER }),
        null,
      )
      expect(decision.allowed).toBe(true)
    }
  })
})

describe('attachmentKeysFor', () => {
  const OWNER = '11111111-2222-3333-4444-555555555555'

  it('is empty for an account that never uploaded a photo', () => {
    expect(attachmentKeysFor(OWNER, [])).toEqual([])
  })

  it('puts the owner folder back on each name', () => {
    expect(
      attachmentKeysFor(OWNER, [
        { name: 'abc123.jpg', id: 'a' },
        { name: 'def456.png', id: 'b' },
      ]),
    ).toEqual([`${OWNER}/abc123.jpg`, `${OWNER}/def456.png`])
  })

  it("skips Supabase's own empty-folder bookkeeping", () => {
    expect(
      attachmentKeysFor(OWNER, [
        { name: '.emptyFolderPlaceholder', id: null },
        { name: 'abc123.jpg', id: 'a' },
      ]),
    ).toEqual([`${OWNER}/abc123.jpg`])
  })

  it('skips folder rows, which are listings rather than objects', () => {
    expect(attachmentKeysFor(OWNER, [{ name: 'nested', id: null }])).toEqual([])
  })

  it('refuses a name that would address anything outside the owner folder', () => {
    expect(attachmentKeysFor(OWNER, [{ name: 'someone-else/abc.jpg', id: 'a' }])).toEqual([])
  })
})
