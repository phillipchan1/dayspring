# Subscriptions — state space and guarantees

Two stores can bill a Dayspring account: **Stripe** (web + macOS) and the **App
Store** (iOS, StoreKit 2). One account, one journal, one `profiles` row — but two
independent sources of billing truth, neither of which knows the other exists.
Almost every subscription bug this codebase has had came from that seam.

This is the reference for what is true in every state. The behaviour described
here is enforced by tests, listed at the bottom.

## The row

| Column | Meaning |
|---|---|
| `plan` | `none` · `trialing` · `active` · `cancelled` · `past_due` |
| `plan_source` | `stripe` · `apple` · `null` (app-managed trial, or a legacy row) |
| `trial_ends_at` | End of the app-managed 14-day trial |
| `plan_expires_at` | Renewal date while live; the moment billing failed when `past_due`; the end when `cancelled` |
| `stripe_customer_id` | Never cleared — they may still need the portal for refunds |
| `apple_original_txn` | Never cleared; unique across profiles (one App Store sub, one account) |

## Three questions, three different answers

Conflating these is what produced the two worst bugs here, so they have three
separate functions.

| Question | Function | Keyed on |
|---|---|---|
| Can they open the journal? | `isEntitled` | `plan` + dates. **Never** `plan_source` |
| Where does a *new purchase* go? | `purchaseRoute` | Device first, then "may Apple still charge?" |
| Where is the *existing* relationship managed? | `billingDestination` | `plan_source`, live **or lapsed** |

**Entitlement never depends on who bills.** A Stripe subscriber is entitled on an
iPhone; an App Store subscriber is entitled on the web.

**Purchase is device-first.** On iOS everything goes through StoreKit — App Store
rules, regardless of how the account was billed before. Off iOS, Stripe is
withheld only while Apple *may still charge* (`active`, `trialing`, `past_due` —
Apple's BILLING_RETRY runs up to 60 days). Once Apple reports EXPIRED/REVOKED,
the web must be able to take payment again.

**Management follows the relationship, not entitlement.** A cancelled App Store
subscription is still only visible — and only refundable — in the App Store.

## Grace: `GRACE_DAYS = 3`

Access outlives the moment billing says it should stop, in exactly two cases:

- **A dropped renewal.** An `active` row past `plan_expires_at` means we never
  heard the renewal (Apple stops retrying after ~3 days; we may have been down).
  The subscriber is paying. Grace it, then lapse it — one lost webhook must not
  mean free access forever, and the next event self-heals it either way.
- **A failed card.** `past_due` is the start of dunning, not the end of the
  relationship. Stripe retries for days and most dunning recovers.

The trial gets **no** grace — its whole contract is its end date.

This is the one number here that is a product/revenue judgement rather than a
correctness constraint. It lives in `api/_lib/entitlement.ts` (mirrored in
`src/lib/subscription.ts`); change both or the parity test fails.

## The cross-store guard

`shouldApplyUpdate()` in `api/_lib/updateSubscription.ts` gates **every** write.

The scenario it exists for: someone cancels on Stripe and resubscribes on the App
Store. Stripe does not fire `customer.subscription.deleted` when they click
cancel — it fires at the **end of the period they already paid for**, which can be
a month later, after the Apple purchase. That event still matches the row by
`stripe_customer_id`. Unguarded it stamps `cancelled/stripe` over a live, paying
App Store subscription and drops the customer onto the paywall. The mirror image
is equally real: a late Apple `EXPIRED` still matches on `apple_original_txn`.

The rule, which needs no ordering guarantees from either store:

1. Same store, or no store recorded → apply. Each store owns its own subscription.
2. Different store, and the write is a **takeover** (an affirmative `active`/
   `trialing` grant that is live now) → apply. Money changed hands; the new store
   is the truth.
3. Different store, not a takeover, account currently entitled → **drop**.
4. Different store, not a takeover, not entitled → apply. Nothing to protect.

`past_due` is deliberately *not* a takeover even though grace can leave it
briefly entitled: it is a notice that a card failed at the store the user already
left.

## What the user sees

`entitled` → the journal. Otherwise `LockedScreen`, whose route comes from
`purchaseRoute` / `billingDestination`:

| Row | Web | iOS |
|---|---|---|
| `trialing` / `null` (app-managed) | journal; no portal | journal; no portal |
| trial expired | buy via Stripe | buy via StoreKit |
| `active` / `stripe` | journal; Stripe portal | journal; **Stripe** portal |
| `active` / `apple` | journal; apps.apple.com | journal; native sheet |
| `cancelled` / `stripe` | buy via Stripe | buy via StoreKit |
| `cancelled` / `apple` | **buy via Stripe**; manage at Apple | buy via StoreKit |
| `past_due` / `stripe` | grace, then "update payment method" → Stripe | same, → Stripe |
| `past_due` / `apple` | grace, then → Apple; **no** Stripe offer | grace, then native sheet |

The invariant: **nobody is ever locked out with nothing to press.** Whenever we
withhold a purchase, "Manage billing" must reach the store doing the withholding.
Swept over every reachable row shape in the journey suite.

## Restore purchases

`restoreApplePurchases()` returns a `RestoreOutcome`, not a count. Two rules:

- **One bad transaction must not sink the restore.** StoreKit routinely returns
  several transactions per Apple ID, including expired ones that 404. All are
  verified in parallel and settled independently.
- **Count entitlement, not transactions.** Restoring an *expired* subscription is
  the expected outcome for someone who genuinely lapsed. Saying "restored!" and
  then showing the paywall reads as a broken app. `describeRestore()` produces
  the same honest message on all three surfaces.

The cross-account 409 (`subscription_owned_by_other_account`) is passed through
verbatim — it names the sign-in button to press, and is the most common real
restore failure (subscribed with Google, later signed in with Apple).

## Double billing

Not fully preventable — the stores are independent — so it is blocked where we
can and reported where we can't:

- `/api/stripe/checkout` returns 409 while `appleMayStillCharge`. The client
  hides the button via the same rule; the server is the backstop.
- `/api/apple/verify` does **not** block a purchase when a live Stripe
  subscription exists — StoreKit has already taken the money by then, and
  refusing would leave them charged *and* locked out. It returns
  `alsoBilledByStripe`, which `purchaseApple()` turns into a visible warning
  telling them to cancel the web subscription.

## Ordering

Neither store guarantees delivery order and both warn about duplicates, so no
handler may trust the sequence it sees.

- **Apple**: a notification says only *which* subscription moved;
  `resolveAppleSubscription` then re-reads the truth from
  `getAllSubscriptionStatuses`. (`apple_last_txn_id` is stored for support, not
  used for sequencing.)
- **Stripe**: `customer.subscription.*` handlers re-retrieve the subscription
  rather than trusting the event body, for the same reason — a reversed pair of
  `.updated` events would otherwise write a stale status, and the cross-store
  guard cannot help there because the source matches. Falls back to the event
  body if the re-read fails.

## Tests

| File | Covers |
|---|---|
| `src/lib/subscription.test.ts` | Entitlement, grace boundaries, routing, cache |
| `api/_lib/updateSubscription.test.ts` | The cross-store guard, both directions |
| `api/_lib/entitlementParity.test.ts` | Client and server agree across all 2,835 states |
| `api/_lib/subscriptionJourneys.test.ts` | Event sequences end-to-end + the no-dead-end sweep |
| `src/lib/appleIap.test.ts` | Restore isolation, cross-account, messaging |

```bash
npx vitest run src/lib/subscription.test.ts src/lib/appleIap.test.ts api/_lib/updateSubscription.test.ts api/_lib/entitlementParity.test.ts api/_lib/subscriptionJourneys.test.ts
```

## Not covered by tests

Deliberate gaps, all requiring a live store:

- StoreKit itself (purchase sheet, Ask to Buy, Family Sharing) — needs a device.
- Apple/Stripe **signature verification** — exercised only against real payloads.
- Sandbox vs production environment fall-through in `api/_lib/apple.ts`.
- The Stripe re-read in `currentSubscription()` — a thin SDK wrapper.
- Whether the webhooks are actually *configured* in App Store Connect and the
  Stripe dashboard. Nothing in this repo can assert that; verify before launch.

## Known gaps — open decisions

Deliberately not built. None blocks the flows above; each is a judgement call.

1. **Stripe refunds and chargebacks.** `charge.refunded` and
   `charge.dispute.created` are unhandled, so a refund alone does not revoke
   access. Apple's REFUND/REVOKE *is* handled. In practice a Stripe dispute
   usually cancels the subscription too, which fires `.deleted` — but that is
   Stripe's behaviour, not our guarantee.
2. **`cancel_at_period_end` is invisible.** Someone who cancelled but is still
   inside their paid period sees "Active" with no end date. Correct on access,
   thin on honesty; Stripe's own portal does show it.
3. **`api/webhooks/revenuecat.ts` is live but unused.** The architecture went
   direct StoreKit (see `docs/` and the Apple IAP notes) — this is a
   plan-writing endpoint with no caller. It rejects everything when
   `REVENUECAT_WEBHOOK_SECRET` is unset and its writes go through the same
   guard, so it is inert rather than dangerous. Worth deleting.
4. **No reconciliation sweep.** If webhooks are lost for longer than
   `GRACE_DAYS`, a paying user lapses and has to hit Refresh (or Restore on
   iOS) to self-heal. A periodic re-read against both stores would close it.
