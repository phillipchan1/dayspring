// POST /api/webhooks/revenuecat
// RevenueCat webhook for Apple IAP lifecycle events. Validates the shared
// secret, then writes profiles.plan (source: apple). Instant post-purchase
// entitlement also goes through /api/apple/sync-purchase.

import { env } from '../_lib/env.js'
import { updateSubscriptionByUserId } from '../_lib/updateSubscription.js'
import type { Plan } from '../_lib/entitlement.js'

// RevenueCat sends the secret in the Authorization header.
function isAuthorized(req: Request): boolean {
  const secret = env.revenuecatWebhookSecret()
  if (!secret) return false // secret not configured → reject all
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  return token === secret
}

interface RCEvent {
  event: {
    type: string
    app_user_id: string
    original_app_user_id?: string
    expiration_at_ms?: number
    purchased_at_ms?: number
    period_type?: string
    /** Original Apple transaction id when present. */
    original_transaction_id?: string
    transaction_id?: string
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: RCEvent
  try {
    body = (await req.json()) as RCEvent
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { type, app_user_id, expiration_at_ms, period_type, original_transaction_id, transaction_id } =
    body.event

  // RevenueCat app_user_id = Supabase user ID (set as StoreKit appAccountToken).
  const userId = app_user_id
  if (!userId || userId.startsWith('$RCAnonymousID')) {
    // Anonymous / unset — ignore; we only entitle signed-in Dayspring users.
    return Response.json({ received: true, ignored: 'anonymous' })
  }

  const expiresAt = expiration_at_ms
    ? new Date(expiration_at_ms).toISOString()
    : null

  let plan: Plan = 'none'
  let trialEndsAt: string | null | undefined

  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
      plan = period_type === 'TRIAL' ? 'trialing' : 'active'
      if (plan === 'trialing' && expiresAt) trialEndsAt = expiresAt
      break
    case 'TRIAL_STARTED':
      plan = 'trialing'
      if (expiresAt) trialEndsAt = expiresAt
      break
    case 'TRIAL_CONVERTED':
      plan = 'active'
      break
    case 'CANCELLATION':
      // Still entitled until expiration — keep current plan semantics as cancelled
      // only after EXPIRATION; mark cancelled so Settings can show status.
      plan = 'cancelled'
      break
    case 'BILLING_ISSUE':
      plan = 'past_due'
      break
    case 'EXPIRATION':
      plan = 'cancelled'
      break
    default:
      return Response.json({ received: true })
  }

  await updateSubscriptionByUserId(userId, {
    plan,
    plan_expires_at: expiresAt,
    ...(trialEndsAt !== undefined ? { trial_ends_at: trialEndsAt } : {}),
    apple_original_txn: original_transaction_id ?? transaction_id ?? null,
    source: 'apple',
  })

  return Response.json({ received: true })
}
