# iOS launch — working tracker

> **Temporary.** This file exists to hold launch state while it is in flight.
> Delete it once Dayspring is live on the App Store; anything worth keeping
> should have moved into `docs/IOS.md` (how it works) by then.

Pipeline is done — see `docs/IOS.md`. What remains is policy, payments,
measurement, and store collateral.

**Status:** pipeline built, nothing submitted.
**Blocking submission:** payments, Sign in with Apple, account deletion, privacy policy.

---

## 0. Decisions to lock first

These fork the work below. Recorded here so the answer stops getting relitigated.

| Decision | Recommendation | Why |
|---|---|---|
| IAP layer | `tauri-plugin-iap` (StoreKit 2) + RevenueCat REST | RevenueCat has no Tauri SDK — see §1 |
| Analytics vendor | PostHog | Only option that answers funnel questions — see §3 |
| iPhone-only or universal | iPhone-only for v1 | Halves the screenshot and review surface — see §4 |
| Mac App Store | Defer until after iOS ships | See §5 |

---

## 1. Payments — Apple IAP alongside Stripe

### The constraint

Apple (3.1.1): a subscription unlocking app functionality, purchased **on iOS**,
must go through IAP. But (3.1.3(b), multiplatform services): a subscription
bought on the web can be **honored** on iOS. So the rule is about where the
transaction happens, not where it is consumed:

- Already entitled, any source → let them in. Never show a paywall.
- Not entitled, on iOS → IAP only. No link to Stripe Checkout.
- Not entitled, on web/desktop → Stripe, as today.

(The 2025 US anti-steering injunction does allow external purchase links in the
US storefront. It is US-only and still moving. Don't build v1 on it.)

### The Tauri problem

RevenueCat publishes no Tauri SDK and has said it isn't planned, so there is no
drop-in. Two moving parts are needed:

1. **Native bridge** — StoreKit 2 has to be called from Swift.
   [`tauri-plugin-iap`](https://github.com/Choochmeque/tauri-plugin-iap) (Tauri v2,
   StoreKit 2, iOS + macOS) is the closest thing to off-the-shelf.
   Fallback: our own Tauri iOS plugin in Swift — Tauri v2 supports this, and the
   surface we need is small (list products, buy, restore, current entitlements).
2. **Server validation** — post the signed transaction to
   [RevenueCat's REST API](https://www.revenuecat.com/docs/api-v1), which then
   fires the webhook `api/webhooks/revenuecat.ts` already handles.
   Alternative: skip RevenueCat, take Apple's App Store Server Notifications V2
   directly. Fewer dependencies, but we write receipt validation and the renewal
   state machine ourselves. RevenueCat is free under $2.5k monthly tracked
   revenue and throws in revenue dashboards, so it wins for now.

- [ ] **Spike (do this first, timebox it).** Prove `tauri-plugin-iap` can buy a
      sandbox subscription inside our Tauri iOS build and hand back a signed
      transaction. Everything below assumes it can. If it can't, the fallback is
      a hand-written Swift plugin and the estimate roughly doubles.
- [ ] Confirm the plugin can set `appAccountToken` on the purchase — that is what
      ties an Apple transaction to a Supabase user id. Without it, linking is
      guesswork.

### Reconciliation

`profiles` today has a single `plan` + `plan_source`. Both webhooks write that
row, which races: an Apple renewal and a Stripe cancellation landing in the wrong
order silently strips an entitled user. Last-writer-wins is the wrong model when
there are two independent writers.

Fix: **stop collapsing sources on write.** One row per (owner, source), and
derive entitlement.

```sql
create table public.subscriptions (
  owner            uuid not null references auth.users (id) on delete cascade,
  source           text not null check (source in ('stripe','apple')),
  plan             text not null check (plan in ('none','trialing','active','cancelled','past_due')),
  trial_ends_at    timestamptz,
  plan_expires_at  timestamptz,
  external_id      text,          -- stripe subscription id | RC original_transaction_id
  event_at         timestamptz not null,  -- source event time, for out-of-order guard
  updated_at       timestamptz not null default now(),
  primary key (owner, source)
);
```

- [ ] Migration: create `subscriptions`, backfill from `profiles`
- [ ] `reconcileEntitlement(owner)` in `api/_lib/` — reads every source row, picks
      the winner (entitled beats not entitled; then latest expiry), writes the
      derived `profiles.plan` / `plan_source`. `profiles` becomes a read cache,
      not the source of truth.
- [ ] Out-of-order guard: a webhook applies its update only if its `event_at` is
      `>=` the stored one. Apple and Stripe both redeliver; neither guarantees order.
- [ ] Both webhooks (`stripe.ts`, `revenuecat.ts`) write their own row, then call
      `reconcileEntitlement`. Neither ever writes `profiles.plan` directly again.
- [ ] `plan_source` keeps meaning "which store bills them", so it also covers a
      future Mac App Store build without a schema change.

### Client

- [ ] `PaywallScreen` splits on `isMobileTauri()` — IAP products on iOS, Stripe
      Checkout everywhere else. Same component, same copy, different purchase call.
- [ ] "Manage subscription" must route by `plan_source`: Stripe billing portal for
      `stripe`, `itms-apps://apps.apple.com/account/subscriptions` for `apple`.
      Showing an Apple subscriber a Stripe portal is both broken and a rejection risk.
- [ ] **Restore Purchases** button on the iOS paywall. Apple requires it; its
      absence is a stock rejection.
- [ ] Double-subscribe guard: if a user is already entitled via Stripe, the iOS
      paywall never renders — show subscribed state instead. Nothing stops someone
      from buying twice through both stores otherwise, and the refund is manual.
- [ ] Trial: today it is app-managed (14-day reverse trial granted at sign-in).
      Apple introductory offers are configured per-product in App Store Connect.
      Decide whether iOS keeps the app-managed trial or uses Apple's — don't ship
      both to the same user.

### Test

- [ ] Sandbox tester buys on iOS → webhook → entitled on web within seconds
- [ ] Web Stripe subscriber opens iOS app → entitled, no paywall
- [ ] Apple cancellation → loses access at period end, not immediately
- [ ] Stripe webhook replayed out of order → entitlement survives
- [ ] Billing retry / grace period → `past_due`, not a hard lockout

---

## 2. Sign in with Apple, account deletion, privacy policy

Three separate, unrelated blockers. All required for submission.

- [ ] **Sign in with Apple** (4.8). Sign-in is Google-only, which obligates an
      equivalent privacy-preserving option. Supabase supports Apple as a provider,
      so it is provider config in Supabase + Apple, a Services ID, a key, and a
      second button in `SignIn.tsx`. The existing deep-link PKCE flow is reused
      unchanged. Cheapest item on this page.
- [ ] **In-app account deletion** (5.1.1(v)). Settings currently offers sign-out
      and settings-reset only. Needs a real delete: `auth.users` row plus every
      owned table, behind a typed confirmation. Most tables already cascade on
      `owner`; audit for the ones that don't.
- [ ] **Privacy policy.** Required as a URL on the listing and there is no page.
      Must cover what leaves the device — journal text, audio, and images go to
      OpenAI — and the retention story. Host at `/privacy` on the Vercel app.
- [ ] **Terms of use.** Apple requires an EULA link for auto-renewable
      subscriptions, alongside price/period/renewal disclosure *on the paywall
      itself*. Default Apple EULA is fine; the paywall text is not optional.

---

## 3. Analytics

Less work than it looks. `src/lib/analytics.ts` already has the closed event
vocabulary, the `shareUsage` gate, and a `setAnalyticsTransport` seam with no
vendor behind it. This is one adapter, not a project.

**Recommendation: PostHog.** The questions at launch are funnel questions —
install → sign in → first entry → trial → paid, and where it leaks. Aptabase is
the more natural Tauri fit (there is a Tauri plugin, it is privacy-first, it is
tiny) but it does counts and little else, so it can't answer any of them. One
PostHog project ingests web, desktop, and iOS with a `platform` super-property.

- [ ] PostHog adapter behind `setAnalyticsTransport`. No call sites change.
- [ ] **Autocapture off. Session replay off.** Non-negotiable — replay on a
      journaling app records what people write. This is the single way analytics
      could seriously hurt this product.
- [ ] `person_profiles: 'identified_only'`, identified by Supabase user id
- [ ] `platform` super-property: `web` | `desktop` | `ios`
- [ ] Extend the event vocabulary for the funnel: `signed_in`, `entry_created`,
      `paywall_viewed`, `purchase_started`, `purchase_completed` (with `source`).
      Keep every prop enum/number/boolean — the no-free-text rule is what makes
      the privacy claim structural rather than a promise.
- [ ] Verify the iOS build's requests aren't blocked by the WKWebView CSP
      (`app.security.csp` is currently `null`, so this should be fine — confirm)
- [ ] Revenue analytics: don't build it. RevenueCat's charts cover MRR, trial
      conversion, and churn, and it can forward events into PostHog.

---

## 4. App Store collateral

- [ ] **Decide device family.** `TARGETED_DEVICE_FAMILY` is `"1,2"` (universal),
      which means iPad screenshots and an iPad review pass. Recommend `"1"`
      (iPhone) for v1 — the layout has had far more phone attention than tablet
      attention. Adding iPad later is a settings change, not a resubmission risk.
- [ ] App name (30 chars) + subtitle (30)
- [ ] Promotional text (170) — editable without a new build, unlike the description
- [ ] Description (4000) and keywords (100, comma-separated, no spaces)
- [ ] Screenshots — 6.9" iPhone is the only required size; the rest downscale.
      Capture on simulator. If universal is kept, 13" iPad is required too.
- [ ] App icon 1024×1024 — already generated, verified RGB with no alpha ✓
- [ ] Support URL and marketing URL (both required), privacy policy URL (see §2)
- [ ] Category — Lifestyle. Health & Fitness invites scrutiny we have no reason to attract.
- [ ] Age rating questionnaire
- [ ] App Privacy nutrition label — declare journal content, audio, and images,
      including that they are processed by a third party (OpenAI). Getting this
      wrong is a post-launch removal risk, not just a rejection.
- [ ] **Demo account in App Review notes.** Sign-in is Google-only and the flow
      bounces through the system browser and back via `dayspring://` — reviewers
      routinely fail this and reject for "unable to sign in". Adding Sign in with
      Apple (§2) mostly solves it; an email/OTP path for review would too.
      Whichever way, the review notes need working credentials and a short
      walkthrough.
- [ ] Export compliance — already declared via `ITSAppUsesNonExemptEncryption` ✓

---

## 5. Mac App Store

**Recommendation: not now.** Ship iOS, then revisit.

The only real argument for it is Universal Purchase — one subscription covering
iPhone and Mac — and that only becomes meaningful once IAP exists at all. Against
it: App Sandbox has to be adopted (attachments and imports touch the filesystem,
so this is genuine work, not a checkbox), the Tauri auto-updater cannot be used
in a sandboxed MAS build, and it is a second review queue and a second signing
identity for an app that already ships fine via Developer ID + DMG.

Nothing here is blocked by deferring. The §1 schema keeps `plan_source = 'apple'`
meaning "billed by Apple" rather than "bought on iOS", so a MAS build slots in
later without a migration.

- [ ] Revisit after iOS is live and IAP is proven

---

## Rough order

1. IAP spike — everything in §1 rests on it, and it is the one item that could
   invalidate the plan
2. Sign in with Apple + account deletion + privacy policy — small, independent,
   and each one alone blocks submission
3. Payments build-out and reconciliation
4. Analytics adapter — do it before launch so there is a baseline to compare to
5. Collateral, TestFlight with real testers, submit
