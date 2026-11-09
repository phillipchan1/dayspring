import {
  NotificationTypeV2,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'
import { AppleEnvironment } from '../../../api/_lib/apple.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import type { AppleFns } from './apple.ts'
import type { WaitUntil } from './growth.ts'
import {
  profileExists,
  updateSubscriptionByAppleOriginalTxn,
  updateSubscriptionByUserId,
  type BillingWriteCtx,
} from './updateSubscription.ts'

const ENTITLEMENT_AFFECTING = new Set<string>([
  NotificationTypeV2.SUBSCRIBED,
  NotificationTypeV2.DID_RENEW,
  NotificationTypeV2.DID_CHANGE_RENEWAL_PREF,
  NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
  NotificationTypeV2.DID_FAIL_TO_RENEW,
  NotificationTypeV2.GRACE_PERIOD_EXPIRED,
  NotificationTypeV2.EXPIRED,
  NotificationTypeV2.REFUND,
  NotificationTypeV2.REFUND_REVERSED,
  NotificationTypeV2.REVOKE,
  NotificationTypeV2.RENEWAL_EXTENDED,
  NotificationTypeV2.OFFER_REDEEMED,
])

async function handleNotification(
  ctx: BillingWriteCtx,
  apple: AppleFns,
  payload: ResponseBodyV2DecodedPayload,
  environment: (typeof AppleEnvironment)[keyof typeof AppleEnvironment],
): Promise<void> {
  const type = payload.notificationType
  if (!type || !ENTITLEMENT_AFFECTING.has(type)) return

  const signedTransaction = payload.data?.signedTransactionInfo
  if (!signedTransaction) return

  const { transaction } = await apple.verifySignedTransaction(signedTransaction)

  const originalTxn = transaction.originalTransactionId
  const anyTxnId = transaction.transactionId ?? originalTxn
  if (!originalTxn || !anyTxnId) return

  const state = await apple.resolveAppleSubscription(anyTxnId, environment)
  if (!state) return

  const update = {
    plan: state.plan,
    source: 'apple' as const,
    trial_ends_at: state.trialEndsAt,
    plan_expires_at: state.expiresAt,
    apple_original_txn: state.originalTransactionId,
    apple_product_id: state.productId,
    apple_environment: (environment === AppleEnvironment.SANDBOX ? 'Sandbox' : 'Production') as
      | 'Sandbox'
      | 'Production',
    apple_last_txn_id: state.transactionId,
  }

  const token = state.appAccountToken ?? transaction.appAccountToken?.toLowerCase() ?? null
  if (token && (await profileExists(ctx.sql, token))) {
    await updateSubscriptionByUserId(ctx, token, update)
    return
  }

  const outcome = await updateSubscriptionByAppleOriginalTxn(ctx, state.originalTransactionId, update)
  if (outcome !== 'no-match') return

  console.warn(
    `[apple webhook] ${type} for unclaimed subscription ${state.originalTransactionId} — ` +
      'awaiting device verification',
  )
}

export async function handleAppleWebhook(
  req: Request,
  sql: Sql,
  env: Env,
  apple: AppleFns,
  waitUntil?: WaitUntil,
): Promise<Response> {
  let body: { signedPayload?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!body.signedPayload) {
    return Response.json({ error: 'missing signedPayload' }, { status: 400 })
  }

  let verified
  try {
    verified = await apple.verifySignedNotification(body.signedPayload)
  } catch (e) {
    console.error('[apple webhook] signature verification failed', e)
    return Response.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    await handleNotification(
      { sql, env, waitUntil },
      apple,
      verified.payload,
      verified.environment,
    )
  } catch (e) {
    console.error('[apple webhook] handler error', verified.payload.notificationType, e)
    return Response.json({ error: 'handler failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}
