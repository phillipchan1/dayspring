// DELETE /api/account/delete
//
//   Authorization: Bearer <supabase access token>
//   → { deleted: true } | 409 { error, blockedBy } | 502/500 { error }
//
// Irreversibly deletes the signed-in account: every row this person owns, every
// photo they uploaded, and the auth user itself. There is no undo, no grace
// window, and no scheduled purge to wait for — see docs/ACCOUNT_DELETION.md for
// the full inventory of what goes and what stays.
//
// The whole endpoint is arranged around one rule: **never destroy the account
// while a store is still billing it.** Someone who deletes their journal and
// then keeps getting charged for it has been robbed, and once the profile row
// is gone we no longer hold the handle (`stripe_customer_id`) that would let us
// stop it. So the order is deliberate, and every step fails closed:
//
//   1. Ask whether deletion is allowed at all → 409, nothing touched.
//   2. Cancel Stripe → 502 on failure, nothing touched.
//   3. Delete storage objects → 500 on failure, account intact.
//   4. Delete the auth user; every table cascades from it.
//
// A failure between 2 and 4 leaves someone with an account and no subscription,
// which they can fix by subscribing again. The opposite — no account and a live
// subscription — is the one outcome they cannot fix themselves.
//
// The asymmetry between the two stores is Apple's, not ours: the App Store
// Server API has no cancellation endpoint. Only the subscriber can cancel, in
// the App Store. So Stripe we cancel; Apple we refuse to delete around.

import { appleEnvironmentFrom, appleWillRenew } from '../_lib/apple.js'
import { preflight, withCors } from '../_lib/cors.js'
import { appleMayStillCharge, type PlanState } from '../_lib/entitlement.js'
import { stripe } from '../_lib/stripe.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { scheduleAccountContactRemoval } from '../_lib/resendAudience.js'

/** Private bucket holding entry photos, keyed `<owner-uuid>/<sha256>.<ext>`. */
const BUCKET = 'attachments'

/** Storage list page size. The API caps a single `list` well above this. */
const STORAGE_PAGE = 1000

// ---------------------------------------------------------------------------
// The gate — pure, and tested directly in delete.test.ts
// ---------------------------------------------------------------------------

/** The profile columns deletion actually reasons about. */
export interface DeletionSubject extends PlanState {
  stripe_customer_id?: string | null
}

export type DeletionBlock = 'apple-will-renew' | 'apple-unknown'

export type DeletionPlan =
  | { allowed: false; blockedBy: DeletionBlock; message: string }
  | { allowed: true; cancelStripeFor: string | null }

const BLOCK_MESSAGES: Record<DeletionBlock, string> = {
  'apple-will-renew':
    'Your subscription is billed by the App Store, and only you can stop it there. ' +
    'Turn off renewal in the App Store, then come back — otherwise Apple would keep ' +
    'charging you for a journal that no longer exists.',
  // Covers both "Apple didn't answer" and the rarer "we hold no transaction to
  // ask about", so it has to offer a way forward as well as a retry — an
  // account nobody can ever delete is its own kind of failure.
  'apple-unknown':
    'We could not confirm with the App Store whether your subscription is still ' +
    'renewing, and we will not delete an account while Apple might still be charging ' +
    'it. Please try again in a few minutes — and if it keeps happening, turn off ' +
    'renewal in the App Store and get in touch.',
}

/**
 * May this account be deleted, and is there a Stripe customer to cancel first?
 *
 * Deliberately not keyed to entitlement. The two questions come apart in both
 * directions and the money is on the other side of the difference:
 *
 *  • An Apple row in BILLING_RETRY is not entitled — Apple is retrying a failed
 *    card, for up to 60 days — but Apple is very much still charging.
 *  • A cancelled Stripe row is not entitled either, and blocks nothing.
 *
 * And it is not keyed to `plan` being live, which is the trap this gate exists
 * to avoid: an App Store subscription stays ACTIVE until the paid period ends,
 * so a user who cancelled an annual plan yesterday would otherwise be refused
 * deletion for another eleven months. `appleWillRenew` is the live answer from
 * Apple — `true` blocks, `false` lets them through, `null` means we could not
 * find out and is treated as "it might".
 *
 * The Stripe sweep is keyed to the customer id alone, not to
 * `plan_source === 'stripe'`. The cross-store guard (docs/SUBSCRIPTIONS.md)
 * means a profile can legitimately read `apple` while an older Stripe
 * subscription is still live, and that is exactly the row we must not miss.
 */
export function planAccountDeletion(
  subject: DeletionSubject | null | undefined,
  appleWillRenewNow: boolean | null,
): DeletionPlan {
  if (appleMayStillCharge(subject) && appleWillRenewNow !== false) {
    const blockedBy: DeletionBlock =
      appleWillRenewNow === true ? 'apple-will-renew' : 'apple-unknown'
    return { allowed: false, blockedBy, message: BLOCK_MESSAGES[blockedBy] }
  }
  return { allowed: true, cancelStripeFor: subject?.stripe_customer_id || null }
}

/** One row of a Supabase Storage listing — only the parts we need. */
export interface StorageObject {
  name: string
  id?: string | null
}

/**
 * Full object keys to remove, from a listing of the owner's storage folder.
 *
 * `list` returns names relative to the prefix, so the owner id has to go back
 * on — a bare name would address the bucket root and, worse, could name another
 * account's folder. Rows with a null `id` are synthetic folder entries rather
 * than objects, and `.emptyFolderPlaceholder` is Supabase's own bookkeeping;
 * neither is a photo, and neither is ours to delete.
 */
export function attachmentKeysFor(ownerId: string, objects: StorageObject[]): string[] {
  return objects
    .filter((o) => o.name && o.id !== null && !o.name.startsWith('.') && !o.name.includes('/'))
    .map((o) => `${ownerId}/${o.name}`)
}

// ---------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function DELETE(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  const sb = supabaseAdmin()
  const { data: profile, error } = await sb
    .from('profiles')
    .select(
      'plan, plan_source, trial_ends_at, plan_expires_at, stripe_customer_id, apple_original_txn, apple_environment',
    )
    .eq('owner', user.id)
    .maybeSingle()
  if (error) return withCors(req, Response.json({ error: error.message }, { status: 500 }))

  // Only ask Apple when Apple could still be charging. Everyone else — the
  // app-managed trial, Stripe, a genuinely expired App Store subscription —
  // skips a network round trip to a store that has nothing to say about them.
  let willRenew: boolean | null = null
  if (appleMayStillCharge(profile)) {
    willRenew = profile?.apple_original_txn
      ? await appleWillRenew(
          profile.apple_original_txn,
          appleEnvironmentFrom(profile.apple_environment),
        )
      : null
  }

  const plan = planAccountDeletion(profile, willRenew)
  if (!plan.allowed) {
    return withCors(
      req,
      Response.json({ error: plan.message, blockedBy: plan.blockedBy }, { status: 409 }),
    )
  }

  if (plan.cancelStripeFor) {
    try {
      await cancelStripeSubscriptions(plan.cancelStripeFor)
    } catch (e) {
      return withCors(
        req,
        Response.json(
          {
            error:
              'We could not cancel your subscription with Stripe, so we have left your ' +
              'account alone rather than delete it while you are still being billed. ' +
              'Please try again shortly.',
            detail: e instanceof Error ? e.message : 'unknown',
          },
          { status: 502 },
        ),
      )
    }
  }

  try {
    await removeAllAttachments(sb, user.id)
  } catch (e) {
    return withCors(
      req,
      Response.json(
        {
          error: 'We could not delete your photos, so nothing else was deleted either.',
          detail: e instanceof Error ? e.message : 'unknown',
        },
        { status: 500 },
      ),
    )
  }

  // Everything this account owns hangs off auth.users(id) with `on delete
  // cascade`, so this one call takes the entries, the photos' rows, the
  // reflections, the Altar, the Lamp, the Concordance, the marks and the
  // profile with it. Storage is the only thing that doesn't cascade, which is
  // why it went first.
  const { error: delErr } = await sb.auth.admin.deleteUser(user.id)
  if (delErr) return withCors(req, Response.json({ error: delErr.message }, { status: 500 }))

  // Best-effort: the daily reconcile drops leftovers if Resend is down here.
  scheduleAccountContactRemoval(user.email)

  return withCors(req, Response.json({ deleted: true }))
}

// ---------------------------------------------------------------------------
// The two external systems
// ---------------------------------------------------------------------------

/** Stripe statuses that are already over. Everything else can still bill. */
const STRIPE_TERMINAL = new Set(['canceled', 'incomplete_expired'])

/**
 * Cancel every subscription this customer still holds, immediately.
 *
 * Not `cancel_at_period_end`: the journal it paid for is about to stop existing,
 * so leaving the subscription running until the period ends buys the user
 * nothing and leaves a live subscription pointed at a deleted account.
 *
 * Throws on the first failure. The caller turns that into a 502 and deletes
 * nothing — an uncancelled subscription is the one error we cannot let through.
 */
async function cancelStripeSubscriptions(customerId: string): Promise<void> {
  const { data } = await stripe().subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  })
  for (const sub of data) {
    if (STRIPE_TERMINAL.has(sub.status)) continue
    await stripe().subscriptions.cancel(sub.id)
  }
}

/** Delete every object under `<ownerId>/` in the attachments bucket. */
async function removeAllAttachments(
  sb: ReturnType<typeof supabaseAdmin>,
  ownerId: string,
): Promise<void> {
  // Listing by prefix rather than reading the `attachments` table on purpose:
  // an upload whose row never landed is still this person's photograph sitting
  // in our storage, and "we deleted everything" has to be true of those too.
  for (;;) {
    const { data, error } = await sb.storage.from(BUCKET).list(ownerId, { limit: STORAGE_PAGE })
    if (error) throw new Error(error.message)

    const keys = attachmentKeysFor(ownerId, data ?? [])
    if (keys.length === 0) return

    const { error: rmErr } = await sb.storage.from(BUCKET).remove(keys)
    if (rmErr) throw new Error(rmErr.message)

    // Each pass deletes what it listed, so the next page starts at the top
    // again. A short page means we've reached the end.
    if ((data?.length ?? 0) < STORAGE_PAGE) return
  }
}
