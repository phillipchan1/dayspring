// Straight port of shouldApplyUpdate / updateColumns from api/_lib/updateSubscription.ts.
// Copied so the Worker does not bundle supabaseAdmin / @vercel/functions.
import { isEntitled, type Plan, type PlanSource, type PlanState } from '../../../api/_lib/entitlement.ts'

export interface SubscriptionUpdate {
  plan: Plan
  trial_ends_at?: string | null
  plan_expires_at?: string | null
  stripe_customer_id?: string | null
  source: PlanSource
  apple_original_txn?: string | null
  apple_product_id?: string | null
  apple_environment?: 'Sandbox' | 'Production' | null
  apple_last_txn_id?: string | null
}

export type WriteOutcome = 'applied' | 'no-match' | 'stale-cross-store'

export interface CurrentPlanRow {
  plan: Plan
  plan_source: PlanSource | null
  trial_ends_at: string | null
  plan_expires_at: string | null
  owner?: string
}

export function shouldApplyUpdate(
  current: CurrentPlanRow | null | undefined,
  update: SubscriptionUpdate,
  now: number = Date.now(),
): boolean {
  if (!current) return true

  const currentSource = current.plan_source ?? null
  if (currentSource === null || currentSource === update.source) return true

  const incoming: PlanState = {
    plan: update.plan,
    plan_source: update.source,
    trial_ends_at:
      update.trial_ends_at !== undefined ? update.trial_ends_at : current.trial_ends_at,
    plan_expires_at:
      update.plan_expires_at !== undefined ? update.plan_expires_at : current.plan_expires_at,
  }

  const takeover =
    (update.plan === 'active' || update.plan === 'trialing') && isEntitled(incoming, now)
  if (takeover) return true

  return !isEntitled(current, now)
}

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

export function logSkip(key: string, update: SubscriptionUpdate, current: CurrentPlanRow): void {
  console.warn(
    `[subscription] dropped stale ${update.source} write (plan=${update.plan}) for ${key} — ` +
      `account is currently entitled via ${current.plan_source} (plan=${current.plan})`,
  )
}
