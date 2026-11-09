import { isEntitled, type PlanState } from '../../../api/_lib/entitlement.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import type { AppleFns } from './apple.ts'
import type { WaitUntil } from './growth.ts'
import {
  ownerByAppleOriginalTxn,
  planStateByOwner,
  signInProvidersFor,
  updateSubscriptionByUserId,
} from './updateSubscription.ts'

const LABELS: Record<string, string> = { google: 'Google', apple: 'Apple' }

function crossAccountMessage(providers: string[]): string {
  const labels = providers.map((p) => LABELS[p]).filter(Boolean)

  if (labels.length === 0) {
    return (
      'This App Store subscription belongs to a different Dayspring account. ' +
      'Sign out here, then sign back in the way you did when you subscribed.'
    )
  }

  const named =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`

  return (
    `This App Store subscription is already on a Dayspring account that signs in with ${named}. ` +
    (labels.length === 1
      ? `Sign out here, then choose "Continue with ${labels[0]}" to get back to it.`
      : 'Sign out here, then use the button you used when you subscribed.')
  )
}

async function crossAccountResponse(sql: Sql, ownerId: string): Promise<Response> {
  const providers = await signInProvidersFor(sql, ownerId)
  return Response.json(
    { error: crossAccountMessage(providers), code: 'subscription_owned_by_other_account' },
    { status: 409 },
  )
}

export async function handleAppleVerify(
  req: Request,
  sql: Sql,
  env: Env,
  user: { id: string },
  apple: AppleFns,
  waitUntil?: WaitUntil,
): Promise<Response> {
  let body: { jws?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const jws = body.jws
  if (!jws || typeof jws !== 'string') {
    return Response.json({ error: 'jws is required' }, { status: 400 })
  }

  let verified
  try {
    verified = await apple.verifySignedTransaction(jws)
  } catch (e) {
    console.error('[apple verify] signature verification failed', e)
    return Response.json({ error: 'invalid transaction' }, { status: 400 })
  }

  const { transaction, environment } = verified
  const anyTxnId = transaction.transactionId ?? transaction.originalTransactionId
  if (!anyTxnId) {
    return Response.json({ error: 'transaction has no id' }, { status: 400 })
  }

  let state
  try {
    state = await apple.resolveAppleSubscription(anyTxnId, environment)
  } catch (e) {
    console.error('[apple verify] status lookup failed', e)
    return Response.json({ error: 'could not reach the App Store' }, { status: 502 })
  }
  if (!state) {
    return Response.json({ error: 'no subscription found' }, { status: 404 })
  }

  if (state.appAccountToken && state.appAccountToken !== user.id.toLowerCase()) {
    return crossAccountResponse(sql, state.appAccountToken)
  }

  const claimant = await ownerByAppleOriginalTxn(sql, state.originalTransactionId)
  if (claimant && claimant !== user.id) {
    return crossAccountResponse(sql, claimant)
  }

  const existing = await planStateByOwner(sql, user.id)
  const alsoBilledByStripe = existing?.plan_source === 'stripe' && isEntitled(existing as PlanState)
  if (alsoBilledByStripe) {
    console.warn(
      `[apple verify] owner ${user.id} bought on the App Store while a live Stripe ` +
        `subscription (plan=${existing?.plan}) is still running — user is double-billed`,
    )
  }

  const outcome = await updateSubscriptionByUserId({ sql, env, waitUntil }, user.id, {
    plan: state.plan,
    source: 'apple',
    trial_ends_at: state.trialEndsAt,
    plan_expires_at: state.expiresAt,
    apple_original_txn: state.originalTransactionId,
    apple_product_id: state.productId,
    apple_environment: environment === 'Sandbox' ? 'Sandbox' : 'Production',
    apple_last_txn_id: state.transactionId,
  })

  return Response.json({
    plan: state.plan,
    entitled: isEntitled({
      plan: state.plan,
      trial_ends_at: state.trialEndsAt,
      plan_expires_at: state.expiresAt,
    }),
    expiresAt: state.expiresAt,
    productId: state.productId,
    alsoBilledByStripe,
    applied: outcome === 'applied',
  })
}
