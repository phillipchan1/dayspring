# Deleting an account

App Store Review Guideline 5.1.1(v) requires any app that lets you make an
account to let you delete it, from inside the app. That is why this exists. What
it has to get right is narrower and older than the guideline: someone asked us to
destroy years of their own writing, and there is no second attempt at it.

Three files: `api/account/delete.ts` (the destroying),
`src/features/account/DeleteAccountFlow.tsx` (the asking), `src/lib/account.ts`
(the local half). The gate is pure and pinned by `api/account/delete.test.ts`.

## The one rule

**Never destroy the account while a store is still billing it.**

Once `profiles` is gone so is `stripe_customer_id` — the only handle we hold on
the Stripe customer — and `apple_original_txn` with it. After that, a renewal
charge is something nobody at Dayspring can stop and nobody at Dayspring can even
see: late webhooks arrive, match no row, and return `no-match` in silence. A
person paying monthly for a journal that no longer exists would have no way to
find that out except a bank statement.

So the endpoint runs in an order where every step fails closed:

| Step | On failure |
|---|---|
| 1. Is deletion allowed? | 409, nothing touched |
| 2. Cancel Stripe | 502, nothing touched |
| 3. Delete storage objects | 500, account intact |
| 4. Delete the auth user | 500, storage already gone |

A failure between 2 and 4 leaves someone with an account and no subscription.
They can fix that by subscribing again. The opposite — no account, live
subscription — they cannot fix at all.

## Stripe we cancel; Apple we refuse to delete around

The asymmetry is Apple's, not a shortcut of ours. The App Store Server API has
**no cancellation endpoint**. Only the subscriber can cancel an auto-renewable
subscription, in Settings or at apps.apple.com. Stripe has an API for it, so
deletion cancels immediately (not `cancel_at_period_end` — the journal it paid
for is about to stop existing, so the remaining days buy nobody anything).

For Apple the gate is **auto-renew, read live** — not `plan`, and not
entitlement:

- `appleMayStillCharge()` stays true for an `active` Apple row until the paid
  period ends. Blocking on that alone would refuse deletion to an annual
  subscriber for up to a year, which is both cruel and very likely a 5.1.1(v)
  failure in its own right.
- So when Apple may still charge, the server calls `appleWillRenew()`
  (`api/_lib/apple.ts`), which reads `autoRenewStatus` out of the renewal info
  Apple returns from `getAllSubscriptionStatuses`. `true` blocks. `false` lets
  them through — their paid period runs on, and Apple will not charge again.
- `null` means we could not find out, and blocks with a retry message. "We don't
  know" and "it won't renew" must never collapse into one answer when the
  difference is somebody's money.

The Stripe sweep is keyed to `stripe_customer_id` existing, **not** to
`plan_source === 'stripe'`. The cross-store guard (see `docs/SUBSCRIPTIONS.md`)
means a profile can legitimately read `apple` while an older Stripe subscription
is still live, and that is precisely the row a `plan_source` check would miss.

## What is deleted

Everything below carries `owner uuid ... references auth.users (id) on delete
cascade`, so `auth.admin.deleteUser()` takes all of it in one statement:

`entries` · `profiles` · `attachments` · `insights` · `spiritual_items` ·
`reminders` · `echo_candidates` · `echo_dismissals` · `resurface_dismissals` ·
`scripture_refs` · `prayer_threads` · `encounters` · `altar_candidates` ·
`altar_candidate_dismissals` · `item_subjects` · `threads` · `thread_members` ·
`ropes` · `processing_jobs` · `concordance` · `concordance_occurrences` ·
`concordance_events` · `concordance_shadow` · `marks`

In user terms: the entries and their photos, and everything built from them — the
Ascent, the Altar, the Lamp, the Concordance, the marks.

**Storage does not cascade.** Every object under `attachments/<owner>/` is
removed explicitly, before the auth user, by listing the prefix rather than
reading the `attachments` table: an upload whose row never landed is still this
person's photograph sitting in our bucket.

**Locally**, `purgeAfterAccountDeletion()` scrubs the IndexedDB entry cache, the
outbox, pending uploads, dictations, marks and the in-memory surface caches, and
then the owner-scoped flags that ordinary sign-out deliberately keeps. Then the
app reloads, because React state and open editors hold entries in memory and
starting over is the cheapest way to be sure.

## What is not deleted

**`scripture_text`** is a global Bible-text cache keyed by reference and
translation. It is not user data; nothing in it came from anyone's journal.

**Payment records at Stripe and Apple.** Both retain transaction history under
their own legal and tax obligations, and neither offers us a way to erase it. We
cannot delete what we do not hold, and the help article says so plainly rather
than implying a completeness we can't deliver.

Dayspring keeps **no billing record of its own** afterwards:
`stripe_customer_id` and `apple_original_txn` live on `profiles` and cascade away
with it. That is deliberate in both directions — a retained `apple_original_txn`
is partial-unique across profiles, so keeping a tombstone would block the same
person from ever restoring that purchase on a new account.

## Not by accident

Two steps in the UI, then the word `DELETE` typed by hand (trimmed,
case-insensitive — phone keyboards autocapitalise and failing someone over that
is just rude). The backup is offered inside the flow, not left as something the
user is expected to think of, because they only get one chance to think of it.

The flow appears in Settings → About, and again on the locked screen — which
replaces the entire app while a subscription is lapsed, Settings included. Without
that second entry point the one person most likely to want out would be the one
person who couldn't reach the button.
