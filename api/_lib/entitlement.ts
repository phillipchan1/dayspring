export type Plan = 'none' | 'trialing' | 'active' | 'cancelled' | 'past_due'

/** Who bills this subscription. Entitlement never depends on it; deletion does,
 *  because only the billing store can stop the billing. */
export type PlanSource = 'stripe' | 'apple'

export interface PlanState {
  plan: Plan
  plan_source?: PlanSource | null
  trial_ends_at?: string | null
  plan_expires_at?: string | null
}

export function isEntitled(state: PlanState): boolean {
  if (state.plan === 'active') return true
  if (state.plan === 'trialing' && state.trial_ends_at) {
    return new Date(state.trial_ends_at) > new Date()
  }
  return false
}

/**
 * True when the App Store might still take money from this account.
 *
 * The gate on deletion. Apple has no server-side cancel — only the subscriber
 * can turn off auto-renew — so deleting the profile row while Apple is still
 * billing leaves a charge nobody here can stop or even see. We refuse instead.
 *
 * The line is at `cancelled`, not at entitlement, and the difference is
 * `past_due`: BILLING_RETRY means the card failed and Apple is *still retrying
 * it*, for up to 60 days. Not entitled, but still Apple's customer.
 *
 * Mirrored by appleMayStillCharge() in src/lib/subscription.ts, which warns the
 * user before they type. This one is the authority.
 */
export function appleMayStillCharge(state: PlanState | null | undefined): boolean {
  if (state?.plan_source !== 'apple') return false
  return state.plan === 'active' || state.plan === 'trialing' || state.plan === 'past_due'
}
