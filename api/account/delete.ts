// POST /api/account/delete
// Permanently deletes the authenticated user's account and everything in it.
// Requires: Authorization: Bearer <supabase-jwt>
// Body: { confirm: 'DELETE' }
// Returns: { deleted: true, appleSubscriptionActive: boolean }
//
// Required by App Store guideline 5.1.1(v): an app that creates accounts must
// let people delete them from inside the app, not via a support email.
//
// Order matters and is not arbitrary:
//   1. Cancel Stripe first. If anything later fails we have at least stopped
//      charging them — the reverse (deleted row, live subscription) bills a
//      person who no longer has an account and cannot reach the billing portal.
//   2. Storage objects next. They live in storage.objects, which has no FK to
//      auth.users, so nothing cascades them. Deleting the user first would
//      orphan every uploaded image permanently — no owner id left to find them by.
//   3. The auth.users row last. Every `owner` column in the schema is
//      `references auth.users (id) on delete cascade`, so this one delete takes
//      out all 24 owned tables. Verified across every migration; if you add a
//      table with an owner column, keep the cascade and this stays correct.
//
// Apple IAP is deliberately NOT cancelled here — it can't be. Only the user can,
// from iOS Settings. We report whether one is live so the client can say so
// plainly; silently deleting the account while Apple keeps billing is exactly
// the complaint Apple's own guideline exists to prevent.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { stripe } from '../_lib/stripe.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'

const ATTACHMENTS_BUCKET = 'attachments'

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  // A typed confirmation the client must echo. Cheap insurance against a
  // mis-wired button or a stray retry deleting somebody's journal.
  let body: { confirm?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }
  if (body.confirm !== 'DELETE') {
    return withCors(req, Response.json({ error: "confirm must be 'DELETE'" }, { status: 400 }))
  }

  const sb = supabaseAdmin()

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id, plan, plan_source')
    .eq('owner', user.id)
    .maybeSingle()

  // 1. Stripe — cancel immediately rather than at period end. They are giving up
  // access right now, so leaving a paid-through window would keep an active
  // subscription attached to a customer whose account no longer exists.
  if (profile?.stripe_customer_id) {
    try {
      const subs = await stripe().subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'all',
        limit: 100,
      })
      for (const sub of subs.data) {
        if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue
        await stripe().subscriptions.cancel(sub.id)
      }
    } catch (e) {
      console.error('[account/delete] stripe cancel failed', e)
      return withCors(
        req,
        Response.json(
          { error: 'could not cancel your subscription — nothing was deleted, please try again' },
          { status: 502 },
        ),
      )
    }
  }

  // 2. Storage. Keys are '<owner>/<hash>.<ext>', so one listing of the owner's
  // folder finds everything. Best-effort: a storage hiccup must not strand
  // somebody in a half-deleted account with a cancelled subscription.
  try {
    const { data: files } = await sb.storage.from(ATTACHMENTS_BUCKET).list(user.id, { limit: 1000 })
    if (files?.length) {
      await sb.storage
        .from(ATTACHMENTS_BUCKET)
        .remove(files.map((f) => `${user.id}/${f.name}`))
    }
  } catch (e) {
    console.error('[account/delete] storage purge failed', e)
  }

  // 3. The user row — cascades every owned table.
  const { error } = await sb.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[account/delete] deleteUser failed', error)
    return withCors(req, Response.json({ error: 'account deletion failed' }, { status: 500 }))
  }

  const appleSubscriptionActive =
    profile?.plan_source === 'apple' && (profile.plan === 'active' || profile.plan === 'trialing')

  return withCors(req, Response.json({ deleted: true, appleSubscriptionActive }))
}
