// POST /api/apple/verify
//
// The device just completed (or restored) a StoreKit 2 purchase. It sends us the
// signed transaction; we verify it against Apple's roots, ask Apple's server for
// the authoritative subscription state, and write entitlement to Supabase.
//
// Requires: Authorization: Bearer <supabase-jwt>
// Body:     { jws: string }   — jwsRepresentation from the purchase result
// Returns:  { plan, expiresAt, productId }
//
// This endpoint is the *fast path* only. App Store Server Notifications
// (/api/webhooks/apple) are what keep the plan honest over time — renewals,
// refunds and cancellations all arrive there, whether or not the app is open.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { preflight, withCors } from '../_lib/cors.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { resolveAppleSubscription, verifySignedTransaction } from '../_lib/apple.js'
import { updateSubscriptionByUserId } from '../_lib/updateSubscription.js'
import { isEntitled, type PlanState } from '../_lib/entitlement.js'
import { crossAccountMessage, signInProvidersFor } from '../_lib/signInMethods.js'

/**
 * 409 for a subscription that is already another account's. We look up how that
 * account signs in so the message can say which button to use — almost always
 * the same person who started a second account by tapping the other provider.
 */
async function crossAccountResponse(ownerId: string): Promise<Response> {
  const providers = await signInProvidersFor(ownerId)
  return Response.json(
    { error: crossAccountMessage(providers), code: 'subscription_owned_by_other_account' },
    { status: 409 },
  )
}

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  let body: { jws?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const jws = body.jws
  if (!jws || typeof jws !== 'string') {
    return withCors(req, Response.json({ error: 'jws is required' }, { status: 400 }))
  }

  // 1. Prove the payload really came from Apple and really is for our app.
  let verified
  try {
    verified = await verifySignedTransaction(jws)
  } catch (e) {
    console.error('[apple verify] signature verification failed', e)
    return withCors(req, Response.json({ error: 'invalid transaction' }, { status: 400 }))
  }

  const { transaction, environment } = verified
  const anyTxnId = transaction.transactionId ?? transaction.originalTransactionId
  if (!anyTxnId) {
    return withCors(req, Response.json({ error: 'transaction has no id' }, { status: 400 }))
  }

  // 2. Ask Apple what is actually true right now. The device's copy can be
  //    stale (offline restore, a refund issued after purchase), so we never
  //    grant entitlement straight from the JWS.
  let state
  try {
    state = await resolveAppleSubscription(anyTxnId, environment)
  } catch (e) {
    console.error('[apple verify] status lookup failed', e)
    return withCors(req, Response.json({ error: 'could not reach the App Store' }, { status: 502 }))
  }
  if (!state) {
    return withCors(req, Response.json({ error: 'no subscription found' }, { status: 404 }))
  }

  // 3. Refuse to move a subscription between Dayspring accounts.
  //    appAccountToken is set to the purchasing user's id, so a mismatch means
  //    someone is trying to claim a subscription that is already another
  //    account's — or a Family Sharing member is restoring the organiser's
  //    purchase. Either way we do not silently re-point it.
  if (state.appAccountToken && state.appAccountToken !== user.id.toLowerCase()) {
    return withCors(req, await crossAccountResponse(state.appAccountToken))
  }

  const sb = supabaseAdmin()
  const { data: claimant } = await sb
    .from('profiles')
    .select('owner')
    .eq('apple_original_txn', state.originalTransactionId)
    .maybeSingle()

  if (claimant && claimant.owner !== user.id) {
    return withCors(req, await crossAccountResponse(claimant.owner as string))
  }

  // 4. Notice the one case where the user is about to pay twice: a Stripe
  //    subscription that is still live. We do not block the Apple purchase —
  //    StoreKit has already taken the money by the time this call happens, so
  //    refusing would leave them charged and locked out. Instead we report it,
  //    and the client tells them to cancel the web subscription.
  const { data: existing } = await sb
    .from('profiles')
    .select('plan, plan_source, trial_ends_at, plan_expires_at')
    .eq('owner', user.id)
    .maybeSingle<PlanState>()

  const alsoBilledByStripe = existing?.plan_source === 'stripe' && isEntitled(existing)
  if (alsoBilledByStripe) {
    console.warn(
      `[apple verify] owner ${user.id} bought on the App Store while a live Stripe ` +
        `subscription (plan=${existing?.plan}) is still running — user is double-billed`,
    )
  }

  // 5. Write entitlement. plan_source flips to 'apple', which is what makes the
  //    web/desktop UI stop offering Stripe checkout to this user.
  const outcome = await updateSubscriptionByUserId(user.id, {
    plan: state.plan,
    source: 'apple',
    trial_ends_at: state.trialEndsAt,
    plan_expires_at: state.expiresAt,
    apple_original_txn: state.originalTransactionId,
    apple_product_id: state.productId,
    apple_environment: environment === 'Sandbox' ? 'Sandbox' : 'Production',
    apple_last_txn_id: state.transactionId,
  })

  return withCors(
    req,
    Response.json({
      plan: state.plan,
      // The client cannot re-derive this reliably: `plan` alone doesn't say
      // whether an expiry has passed, and "restored something" is not the same
      // question as "are you unlocked". Restore UX depends on the difference.
      entitled: isEntitled({
        plan: state.plan,
        trial_ends_at: state.trialEndsAt,
        plan_expires_at: state.expiresAt,
      }),
      expiresAt: state.expiresAt,
      productId: state.productId,
      alsoBilledByStripe,
      // 'stale-cross-store' here would mean we refused to downgrade a live
      // Stripe plan with a dead Apple one — surfaced so the client doesn't
      // report a successful restore that changed nothing.
      applied: outcome === 'applied',
    }),
  )
}
