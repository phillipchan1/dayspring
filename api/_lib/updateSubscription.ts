import { supabaseAdmin } from './supabaseAdmin.js'
import type { Plan } from './entitlement.js'

export interface SubscriptionUpdate {
  plan: Plan
  trial_ends_at?: string | null
  plan_expires_at?: string | null
  stripe_customer_id?: string | null
  source: 'stripe' | 'apple'
  // Apple-only bookkeeping. Set on every Apple write so a later App Store Server
  // Notification can find this row by original transaction id even when the
  // notification carries no appAccountToken.
  apple_original_txn?: string | null
  apple_product_id?: string | null
  apple_environment?: 'Sandbox' | 'Production' | null
  apple_last_txn_id?: string | null
}

/** Only write columns the caller actually set — `undefined` means "leave alone",
 *  explicit `null` means "clear". Without this distinction a renewal webhook
 *  would blank out trial_ends_at just by not mentioning it. */
function columns(update: SubscriptionUpdate): Record<string, unknown> {
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

/** Update plan by Supabase user ID (use on checkout.session.completed). */
export async function updateSubscriptionByUserId(
  userId: string,
  update: SubscriptionUpdate,
): Promise<void> {
  const sb = supabaseAdmin()
  await sb
    .from('profiles')
    .upsert({ owner: userId, ...columns(update) }, { onConflict: 'owner' })
    .throwOnError()
}

/** Update plan by Stripe customer ID (use on subscription lifecycle events). */
export async function updateSubscriptionByStripeCustomer(
  stripeCustomerId: string,
  update: Omit<SubscriptionUpdate, 'stripe_customer_id'>,
): Promise<void> {
  const sb = supabaseAdmin()
  await sb
    .from('profiles')
    .update(columns(update))
    .eq('stripe_customer_id', stripeCustomerId)
    .throwOnError()
}

/**
 * Update plan by Apple original transaction ID.
 *
 * This is the fallback path for App Store Server Notifications that arrive
 * without an appAccountToken — a renewal of a subscription bought before we set
 * one, or a Family Sharing member. Returns false when no profile claims this
 * subscription yet, which is the caller's cue to drop the notification and wait
 * for the device to call /api/apple/verify rather than guessing at an owner.
 */
export async function updateSubscriptionByAppleOriginalTxn(
  originalTransactionId: string,
  update: Omit<SubscriptionUpdate, 'stripe_customer_id'>,
): Promise<boolean> {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('profiles')
    .update(columns(update))
    .eq('apple_original_txn', originalTransactionId)
    .select('owner')
    .throwOnError()
  return (data?.length ?? 0) > 0
}
