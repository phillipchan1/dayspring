// POST /api/webhooks/apple
//
// App Store Server Notifications V2. This is what keeps Apple-sourced
// entitlement honest between app launches: renewals, cancellations, billing
// failures, refunds and revocations all land here whether or not the app is
// open. Configure the URL in App Store Connect (see docs/APPLE_IAP.md).
//
// There is no shared secret and no user auth — the JWS signature, chained to
// Apple's root CA, IS the authentication. Never trust a field before
// verifySignedNotification() has returned.

import {
  NotificationTypeV2,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'
import {
  resolveAppleSubscription,
  verifySignedNotification,
  verifySignedTransaction,
  AppleEnvironment,
} from '../_lib/apple.js'
import {
  updateSubscriptionByAppleOriginalTxn,
  updateSubscriptionByUserId,
} from '../_lib/updateSubscription.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'

/**
 * Notification types that change whether (or for how long) someone is entitled.
 * Everything else — TEST, CONSUMPTION_REQUEST, PRICE_INCREASE consent, metadata
 * churn — is acknowledged and ignored.
 *
 * We deliberately do NOT map each type to a plan. Apple's own
 * getAllSubscriptionStatuses is authoritative and always current, so every
 * relevant notification simply triggers a re-read. That makes out-of-order and
 * duplicate deliveries — both of which Apple explicitly warns about — converge
 * on the right answer instead of racing.
 */
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

export async function POST(req: Request): Promise<Response> {
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
    verified = await verifySignedNotification(body.signedPayload)
  } catch (e) {
    console.error('[apple webhook] signature verification failed', e)
    // 400, not 500: a payload we cannot verify will never verify, so asking
    // Apple to retry it is pointless noise.
    return Response.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    await handleNotification(verified.payload, verified.environment)
  } catch (e) {
    console.error('[apple webhook] handler error', verified.payload.notificationType, e)
    // 500 → Apple retries (up to ~3 days with backoff), which is what we want
    // for a transient Supabase or App Store Server API failure.
    return Response.json({ error: 'handler failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}

async function handleNotification(
  payload: ResponseBodyV2DecodedPayload,
  environment: AppleEnvironment,
): Promise<void> {
  const type = payload.notificationType
  if (!type || !ENTITLEMENT_AFFECTING.has(type)) return

  const signedTransaction = payload.data?.signedTransactionInfo
  if (!signedTransaction) return

  // The notification's own transaction only tells us *which* subscription moved.
  // resolveAppleSubscription then re-reads the current truth from Apple.
  const { transaction } = await verifySignedTransaction(signedTransaction)

  const originalTxn = transaction.originalTransactionId
  const anyTxnId = transaction.transactionId ?? originalTxn
  if (!originalTxn || !anyTxnId) return

  const state = await resolveAppleSubscription(anyTxnId, environment)
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

  // Preferred route: the purchase carried our Supabase user id.
  const token = state.appAccountToken ?? transaction.appAccountToken?.toLowerCase() ?? null
  if (token && (await profileExists(token))) {
    await updateSubscriptionByUserId(token, update)
    return
  }

  // Fallback: a row already claims this subscription by original transaction id.
  // 'stale-cross-store' counts as handled — the row deliberately stayed put
  // because this account has since moved to Stripe, and re-running the fallback
  // would only find the same row again.
  const outcome = await updateSubscriptionByAppleOriginalTxn(state.originalTransactionId, update)
  if (outcome !== 'no-match') return

  // No owner yet. This is normal and benign: the notification beat the device's
  // /api/apple/verify call. That call re-reads the same state from Apple, so
  // nothing is lost by dropping this one.
  console.warn(
    `[apple webhook] ${type} for unclaimed subscription ${state.originalTransactionId} — ` +
      'awaiting device verification',
  )
}

/** Guard against writing a profile row for a token that isn't one of our users
 *  (a malformed appAccountToken would otherwise upsert a phantom profile). */
async function profileExists(owner: string): Promise<boolean> {
  const sb = supabaseAdmin()
  const { data } = await sb.from('profiles').select('owner').eq('owner', owner).maybeSingle()
  return data != null
}
