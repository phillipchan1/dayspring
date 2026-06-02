import { supabaseAdmin } from './supabaseAdmin.js'
import type { Plan } from './entitlement.js'

export interface SubscriptionUpdate {
  plan: Plan
  trial_ends_at?: string | null
  plan_expires_at?: string | null
  stripe_customer_id?: string | null
  source: 'stripe' | 'apple'
}

/** Update plan by Supabase user ID (use on checkout.session.completed). */
export async function updateSubscriptionByUserId(
  userId: string,
  update: SubscriptionUpdate,
): Promise<void> {
  const sb = supabaseAdmin()
  await sb
    .from('profiles')
    .upsert(
      {
        owner: userId,
        plan: update.plan,
        plan_source: update.source,
        ...(update.trial_ends_at !== undefined ? { trial_ends_at: update.trial_ends_at } : {}),
        ...(update.plan_expires_at !== undefined ? { plan_expires_at: update.plan_expires_at } : {}),
        ...(update.stripe_customer_id ? { stripe_customer_id: update.stripe_customer_id } : {}),
      },
      { onConflict: 'owner' },
    )
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
    .update({
      plan: update.plan,
      plan_source: update.source,
      ...(update.trial_ends_at !== undefined ? { trial_ends_at: update.trial_ends_at } : {}),
      ...(update.plan_expires_at !== undefined ? { plan_expires_at: update.plan_expires_at } : {}),
    })
    .eq('stripe_customer_id', stripeCustomerId)
    .throwOnError()
}
