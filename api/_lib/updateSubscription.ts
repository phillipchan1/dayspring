import { supabaseAdmin } from './supabaseAdmin.js'
import { isEntitled, type Plan, type PlanSource, type PlanState } from './entitlement.js'

export interface SubscriptionUpdate {
  plan: Plan
  trial_ends_at?: string | null
  plan_expires_at?: string | null
  stripe_customer_id?: string | null
  source: PlanSource
  // Apple-only bookkeeping. Set on every Apple write so a later App Store Server
  // Notification can find this row by original transaction id even when the
  // notification carries no appAccountToken.
  apple_original_txn?: string | null
  apple_product_id?: string | null
  apple_environment?: 'Sandbox' | 'Production' | null
  apple_last_txn_id?: string | null
}

/** What a write actually did, so callers can log the interesting outcomes. */
export type WriteOutcome =
  /** The row was written. */
  | 'applied'
  /** No profile matched the lookup key — nothing was written. */
  | 'no-match'
  /** Dropped on purpose: a stale event from the store that no longer bills this
   *  account, which would have revoked a live subscription at the other store. */
  | 'stale-cross-store'

/** The subset of a profile row that decides whether an incoming write may land. */
export interface CurrentPlanRow {
  plan: Plan
  plan_source: PlanSource | null
  trial_ends_at: string | null
  plan_expires_at: string | null
}

const CURRENT_COLUMNS = 'plan, plan_source, trial_ends_at, plan_expires_at'

/**
 * May a write from `update.source` overwrite `current`?
 *
 * **The bug this exists to stop.** Someone cancels on Stripe and resubscribes on
 * the App Store. Stripe does not fire `customer.subscription.deleted` when they
 * click cancel — it fires it at the end of the period they already paid for,
 * which can be a month later, *after* the Apple purchase. That event still
 * matches the row by `stripe_customer_id` (we never clear it, and shouldn't —
 * they may still need the portal for refunds). Unguarded, it stamps
 * `plan='cancelled', plan_source='stripe'` over a live, paying App Store
 * subscription and drops the customer onto the paywall.
 *
 * The mirror image is just as real: an Apple `EXPIRED` notification arriving
 * after the user moved to Stripe still matches on `apple_original_txn`.
 *
 * The rule that fixes both, and needs no ordering guarantees from either store:
 *
 *  1. Same store, or no store recorded yet → apply. Each store is the sole
 *     authority on its own subscription.
 *  2. Different store, and the write is a **takeover** — an affirmative
 *     `active`/`trialing` grant that is live right now → apply. Money just
 *     changed hands at the new store; it is now the source of truth.
 *  3. Different store, not a takeover, and the account is currently entitled →
 *     drop it. This is always a late message about the relationship the user
 *     already left.
 *  4. Different store, not a takeover, account already not entitled → apply.
 *     Nothing to protect, and it keeps the recorded source honest.
 *
 * Note this is deliberately blind to timestamps. Neither store guarantees
 * delivery order, so "is the account entitled right now, and who by" is the only
 * question that survives out-of-order and duplicate deliveries.
 */
export function shouldApplyUpdate(
  current: CurrentPlanRow | null | undefined,
  update: SubscriptionUpdate,
  now: number = Date.now(),
): boolean {
  if (!current) return true

  const currentSource = current.plan_source ?? null
  if (currentSource === null || currentSource === update.source) return true

  // `undefined` on the update means "leave this column alone", so the incoming
  // state inherits the current value — evaluating it as null would misread a
  // renewal that only mentions `plan` as an expiry-less grant.
  const incoming: PlanState = {
    plan: update.plan,
    plan_source: update.source,
    trial_ends_at:
      update.trial_ends_at !== undefined ? update.trial_ends_at : current.trial_ends_at,
    plan_expires_at:
      update.plan_expires_at !== undefined ? update.plan_expires_at : current.plan_expires_at,
  }

  // A takeover has to be an *affirmative* grant, not merely something that
  // happens to be entitled. `past_due` is deliberately excluded even though the
  // dunning grace can leave it briefly entitled: it is a notice that a card
  // failed at the store the user already left, and letting it through would
  // stamp a Stripe billing failure over a live, paying App Store subscription —
  // the very clobber this guard exists to stop.
  const takeover =
    (update.plan === 'active' || update.plan === 'trialing') && isEntitled(incoming, now)
  if (takeover) return true

  return !isEntitled(current, now)
}

/** Only write columns the caller actually set — `undefined` means "leave alone",
 *  explicit `null` means "clear". Without this distinction a renewal webhook
 *  would blank out trial_ends_at just by not mentioning it.
 *
 *  Exported so the journey tests can replay a sequence of store events against a
 *  plain object with exactly the merge semantics Postgres applies here. */
export function updateColumns(update: SubscriptionUpdate): Record<string, unknown> {
  const out: Record<string, unknown> = {
    plan: update.plan,
    plan_source: update.source,
  }
  const optional = [
    'trial_ends_at',
    'plan_expires_at',
    'apple_original_txn',
    'apple_product_id',
    'apple_environment',
    'apple_last_txn_id',
  ] as const
  for (const key of optional) {
    if (update[key] !== undefined) out[key] = update[key]
  }
  if (update.stripe_customer_id) out.stripe_customer_id = update.stripe_customer_id
  if (update.source === 'apple') out.apple_updated_at = new Date().toISOString()
  return out
}

function logSkip(key: string, update: SubscriptionUpdate, current: CurrentPlanRow): void {
  console.warn(
    `[subscription] dropped stale ${update.source} write (plan=${update.plan}) for ${key} — ` +
      `account is currently entitled via ${current.plan_source} (plan=${current.plan})`,
  )
}

/** Update plan by Supabase user ID (use on checkout.session.completed and
 *  /api/apple/verify, where we know exactly whose account this is). */
export async function updateSubscriptionByUserId(
  userId: string,
  update: SubscriptionUpdate,
): Promise<WriteOutcome> {
  const sb = supabaseAdmin()
  const { data: current } = await sb
    .from('profiles')
    .select(CURRENT_COLUMNS)
    .eq('owner', userId)
    .maybeSingle<CurrentPlanRow>()

  if (!shouldApplyUpdate(current, update)) {
    logSkip(`owner ${userId}`, update, current!)
    return 'stale-cross-store'
  }

  // Upsert, not update: this is also the path that creates the row for a user
  // who subscribed before a profile existed.
  await sb
    .from('profiles')
    .upsert({ owner: userId, ...updateColumns(update) }, { onConflict: 'owner' })
    .throwOnError()
  return 'applied'
}

/** Update plan by Stripe customer ID (use on subscription lifecycle events). */
export async function updateSubscriptionByStripeCustomer(
  stripeCustomerId: string,
  update: Omit<SubscriptionUpdate, 'stripe_customer_id'>,
): Promise<WriteOutcome> {
  const sb = supabaseAdmin()
  const { data: current } = await sb
    .from('profiles')
    .select(CURRENT_COLUMNS)
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle<CurrentPlanRow>()

  // No row means the customer id was never stored — almost always a
  // subscription event that overtook its own checkout.session.completed. Say so
  // rather than silently updating zero rows; /api/apple/verify's equivalent
  // silence hid a real bug for weeks.
  if (!current) return 'no-match'

  if (!shouldApplyUpdate(current, update)) {
    logSkip(`stripe customer ${stripeCustomerId}`, update, current)
    return 'stale-cross-store'
  }

  await sb
    .from('profiles')
    .update(updateColumns(update))
    .eq('stripe_customer_id', stripeCustomerId)
    .throwOnError()
  return 'applied'
}

/**
 * Update plan by Apple original transaction ID.
 *
 * This is the fallback path for App Store Server Notifications that arrive
 * without an appAccountToken — a renewal of a subscription bought before we set
 * one, or a Family Sharing member. `no-match` means no profile claims this
 * subscription yet, which is the caller's cue to drop the notification and wait
 * for the device to call /api/apple/verify rather than guessing at an owner.
 */
export async function updateSubscriptionByAppleOriginalTxn(
  originalTransactionId: string,
  update: Omit<SubscriptionUpdate, 'stripe_customer_id'>,
): Promise<WriteOutcome> {
  const sb = supabaseAdmin()
  const { data: current } = await sb
    .from('profiles')
    .select(CURRENT_COLUMNS)
    .eq('apple_original_txn', originalTransactionId)
    .maybeSingle<CurrentPlanRow>()

  if (!current) return 'no-match'

  if (!shouldApplyUpdate(current, update)) {
    logSkip(`apple txn ${originalTransactionId}`, update, current)
    return 'stale-cross-store'
  }

  await sb
    .from('profiles')
    .update(updateColumns(update))
    .eq('apple_original_txn', originalTransactionId)
    .throwOnError()
  return 'applied'
}
