import type { Plan } from '../../../api/_lib/entitlement.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import { updateSubscriptionByUserId, type BillingWriteCtx } from './updateSubscription.ts'
import type { WaitUntil } from './growth.ts'

interface RCEvent {
  event: {
    type: string
    app_user_id: string
    original_app_user_id?: string
    expiration_at_ms?: number
    purchased_at_ms?: number
    period_type?: string
    original_transaction_id?: string
    transaction_id?: string
  }
}

function isAuthorized(req: Request, env: Env): boolean {
  const secret = env.REVENUECAT_WEBHOOK_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  return token === secret
}

export async function handleRevenuecatEvent(ctx: BillingWriteCtx, body: RCEvent): Promise<Response> {
  const { type, app_user_id, expiration_at_ms, period_type, original_transaction_id, transaction_id } =
    body.event

  const userId = app_user_id
  if (!userId || userId.startsWith('$RCAnonymousID')) {
    return Response.json({ received: true, ignored: 'anonymous' })
  }

  const expiresAt = expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null

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

  await updateSubscriptionByUserId(ctx, userId, {
    plan,
    plan_expires_at: expiresAt,
    ...(trialEndsAt !== undefined ? { trial_ends_at: trialEndsAt } : {}),
    apple_original_txn: original_transaction_id ?? transaction_id ?? null,
    source: 'apple',
  })

  return Response.json({ received: true })
}

export async function handleRevenuecatWebhook(
  req: Request,
  sql: Sql,
  env: Env,
  waitUntil?: WaitUntil,
): Promise<Response> {
  if (!isAuthorized(req, env)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: RCEvent
  try {
    body = (await req.json()) as RCEvent
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  return handleRevenuecatEvent({ sql, env, waitUntil }, body)
}
