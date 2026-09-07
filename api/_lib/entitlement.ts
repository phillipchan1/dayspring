// Who is entitled to Dayspring, and for how long.
//
// This is the server's copy of a rule the client also needs (src/lib/subscription.ts).
// The two are held to identical behaviour by api/_lib/entitlementParity.test.ts,
// which runs both over the same matrix. Change one, change the other, or that
// test fails — which is the point: a client that thinks you're entitled and a
// server that doesn't is how someone gets locked out of their own journal.

export type Plan = 'none' | 'trialing' | 'active' | 'cancelled' | 'past_due'
export type PlanSource = 'stripe' | 'apple'

export interface PlanState {
  plan: Plan
  plan_source?: PlanSource | null
  trial_ends_at?: string | null
  plan_expires_at?: string | null
}

/**
 * How long access outlives the moment billing says it should stop.
 *
 * Two different failures share this window, both of which should land on the
 * user's side rather than ours:
 *
 *  • **A dropped renewal.** `plan_expires_at` is the next renewal date, so an
 *    `active` row sitting past it means we never heard the renewal — Apple gave
 *    up retrying the notification, or we were down when it arrived. The
 *    subscriber is paying. Locking them out over our missing message is the
 *    worst outcome available.
 *
 *  • **A failed card.** `past_due` is the start of dunning, not the end of the
 *    relationship. Stripe retries for days. Evicting someone from their own
 *    journal the hour a card expires is both bad product ("light, not verdict")
 *    and bad business — most dunning recovers.
 *
 * The window is short enough that a genuine lapse still closes, and the state is
 * self-healing either way: the next webhook or /api/apple/verify writes the
 * truth over it.
 */
export const GRACE_DAYS = 3
const GRACE_MS = GRACE_DAYS * 86_400_000

/**
 * True when `iso` is a real timestamp that fell more than `graceMs` ago.
 *
 * Absent and unparseable timestamps both return false — "we have no evidence
 * this lapsed". Failing open matters here: a null expiry is the normal healthy
 * state for a Stripe subscription, and a malformed one is a data glitch. Neither
 * is a reason to take someone's journal away.
 */
function lapsed(iso: string | null | undefined, now: number, graceMs: number): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return t + graceMs <= now
}

/**
 * The single entitlement question: can this account open the journal right now?
 *
 * `now` is injectable so tests can pin time instead of sleeping.
 */
export function isEntitled(state: PlanState | null | undefined, now: number = Date.now()): boolean {
  if (!state) return false

  switch (state.plan) {
    case 'active':
      // Healthy Stripe rows carry no expiry at all, so this is a no-op for them
      // and a backstop for Apple, where every row has a renewal date.
      return !lapsed(state.plan_expires_at, now, GRACE_MS)

    case 'trialing':
      // A trial we cannot date is a trial we cannot honour. This is the only
      // branch with no grace: the trial's whole contract is its end date.
      return state.trial_ends_at != null && !lapsed(state.trial_ends_at, now, 0)

    case 'past_due':
      // Dunning grace, measured from when billing actually failed. Rows written
      // before that timestamp was recorded get no grace rather than infinite grace.
      return state.plan_expires_at != null && !lapsed(state.plan_expires_at, now, GRACE_MS)

    case 'cancelled':
    case 'none':
      // Both stores only report a subscription cancelled once the paid period is
      // genuinely over, so there is nothing left to grace.
      return false

    default:
      return false
  }
}

/**
 * True when the App Store might still take money from this account.
 *
 * The guard for **purchase** surfaces. Selling a Stripe subscription to someone
 * Apple is also charging is how one person pays twice for one journal, and
 * neither store will refund the other's charge.
 *
 * The line is drawn at `cancelled`, not at entitlement, and the difference is
 * `past_due`: Apple's BILLING_RETRY means the card failed and Apple is *still
 * retrying it*, for up to 60 days. Such a user is not entitled, but they are
 * very much still Apple's customer — and their fix (update the payment method
 * at Apple) works from any browser, so pointing them there strands nobody.
 *
 * Equally, this must NOT be source-based alone. Once Apple reports EXPIRED or
 * REVOKED the relationship is genuinely over, and the user has to be free to
 * subscribe on the web — otherwise anyone who cancelled on iOS and moved off
 * Apple could never pay us again. See `isAppleRelationship` for the separate
 * question of where an existing subscription is *managed*.
 */
export function appleMayStillCharge(state: PlanState | null | undefined): boolean {
  if (state?.plan_source !== 'apple') return false
  return state.plan === 'active' || state.plan === 'trialing' || state.plan === 'past_due'
}

/**
 * True when this account's billing relationship lives at Apple, live or lapsed.
 *
 * This is the guard for **management** surfaces. A cancelled App Store
 * subscription is still only visible — and only refundable — in the App Store,
 * so "Manage billing" must keep pointing there even after it lapses. Sending
 * them to a Stripe portal would show an empty page.
 */
export function isAppleRelationship(state: PlanState | null | undefined): boolean {
  return state?.plan_source === 'apple' && state.plan !== 'none'
}
