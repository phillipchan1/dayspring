// POST /api/webhooks/revenuecat
// RevenueCat webhook for Apple IAP lifecycle events. Stub — wire up when the
// App Store build ships. Already validates the shared secret so no unauthorized
// writes can reach Supabase once a real secret is set.

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
    period_type?: string
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

  const { type, app_user_id, expiration_at_ms } = body.event

  // RevenueCat app_user_id = Supabase user ID (set when initializing the SDK).
  const userId = app_user_id
  const expiresAt = expiration_at_ms
    ? new Date(expiration_at_ms).toISOString()
    : null

  let plan: Plan = 'none'
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
      plan = 'active'
      break
    case 'TRIAL_STARTED':
      plan = 'trialing'
      break
    case 'TRIAL_CONVERTED':
      plan = 'active'
      break
    case 'CANCELLATION':
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
    source: 'apple',
  })

  return Response.json({ received: true })
}
