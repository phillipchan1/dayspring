# Growth Pulse — event catalogue & dashboard spec

Instrumentation for Entrance → Use → Exit, built so Stage 1 of paid acquisition
(D-030, $5/day × 5) can move from "$0 live" to actually spending once the funnel
is visible. This doc is the repo-side half — event names, where they fire, what
they carry, and what to build with them. The PostHog **dashboards themselves**
are built in the PostHog UI (see below) and their embed URLs belong on the
team's Notion "Growth Pulse" page, not here — see `docs/product/README.md`'s
ground rule #1 (Notion is for what a human reads without a git checkout).

Reuses the **existing** PostHog project (`VITE_POSTHOG_KEY` / `us.i.posthog.com`)
everywhere. No second project, no new analytics vendor.

## The three funnels

### Entrance — marketing site (`site/`), anonymous visitor

| Event | Fired from | Props | Vendor |
|---|---|---|---|
| `landing_viewed` | `site/src/pages/index.astro` | `utm_*` | PostHog |
| `intent_clicked` | `site/src/lib/siteAnalytics.ts` (`wireCtaLinks`, on any `/start` link — Hero, PricingTiers, Footer) | `utm_*` | PostHog |
| `start_trial_clicked` | `site/src/pages/start.astro` | `utm_*` | PostHog |
| `PageView` | every page, `site/src/layouts/Base.astro` | — | Meta Pixel |
| `StartTrial` | `site/src/pages/start.astro` | — | Meta Pixel |

`utm_*` = whichever of `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
`utm_term` are present on the URL. This is the one place in the product where a
free-text-shaped prop is allowed — it's marketing attribution data from an
anonymous, pre-signup visitor, not journal content. See `site/src/lib/siteAnalytics.ts`
for the full comment on why that's a different privacy posture from the app's
closed enum vocabulary.

### Use — the app (`src/`), per account, closed enum vocabulary

Full vocabulary lives in `src/lib/analytics.ts`. Grouped here by what each
answers, not by file — Phase B fires from all over `src/features/`.

**Retention**

| Event | Fired from | Meaning |
|---|---|---|
| `app_open` | `src/main.tsx` (`bootstrap()`) | Once per real launch — the D1/D7 retention signal. Carries `platform` (`'mac'\|'ios'\|'web'`, `platformKind()` in `src/lib/platform.ts`) and `version_major`/`version_minor`/`version_patch` (parsed from `__APP_VERSION__`). |

**Activation**

| Event | Fired from | Meaning |
|---|---|---|
| `onboarding_step_viewed` | `OnboardingFlow.tsx` | `step`: `'tour'\|'fork'\|'import'\|'fresh'` — the real step machine (not a flat wizard: `import` has its own inner phase machine in `ImportFlow.tsx` that isn't separately tracked). |
| `onboarding_step_completed` | `OnboardingFlow.tsx`, `ImportFlow.tsx` | Same `step` enum. Fires on a genuine forward move: Begin (not Skip) past the carousel, either fork choice, "Start fresh", the mobile import fallback (which never offers a real import — that IS how the step resolves there), and ImportFlow's Reveal "Enter your journal." |
| `onboarding_skipped` | `OnboardingFlow.tsx` (`tour`), `ImportFlow.tsx` (`import`) | Only these two steps have a real skip path today — Welcome's own Skip button, and ImportFlow's "skip ahead" during the background build. `fork` and `fresh` have no skip (Back is not a skip). |
| `auth_completed` | `src/hooks/useSession.ts` | `method`: `'apple'\|'google'\|'email'`. Gated on a genuine `SIGNED_IN` event — `INITIAL_SESSION` (page load) and `TOKEN_REFRESHED` are separate event types, so a restored session can't double-count as a new sign-in. |
| `first_entry_created` | `src/lib/repo.ts` (`createEntry`) via `src/lib/firstEntry.ts` | This device's first-ever entry. Device-local "first" — same caveat as `surface_opened`'s `first` flag; a returning user's second device fires it again. |
| `minutes_to_first_entry_bucket` | same call site, same moment | `bucket`: `'0_5'\|'5_30'\|'30_1440'\|'1440_plus'` — minutes since this device's first bootstrap (`markDeviceFirstSeen()` in `firstEntry.ts`, stamped once in `main.tsx`), a device-local proxy for "trial start" (the offline-first repo layer that fires `first_entry_created` has no cheap, synchronous way to read the account's real trial-start time). |

**Core loop**

| Event | Fired from | Meaning |
|---|---|---|
| `entry_started` | `JournalScreen.tsx` (`handleNew`) | "New entry" tapped — the one unambiguous "started composing" moment. No `source` prop: beginning a ritual or slash command inside an already-blank entry is a *use* of that entry, not a second, competing start — adding one would double-count the same entry against `handleNew`'s fire. |
| `entry_saved` | `src/hooks/useAutosave.ts` | Fires on **every** successful autosave persist — the create AND every subsequent update, by design ("track a ton now, decide what matters later"). Roll up to "last `entry_saved` per entry per session" for a length distribution rather than treating every row as a distinct save. `length_bucket` (`'empty'\|'1_50'\|'51_200'\|'201_500'\|'500_plus'`, `lengthBucket()` in `analytics.ts`) is from `wordCount()`; `had_ritual` from the literal `<!-- ritual:name: -->` marker in the body; `had_slash` from `parseSpiritualBlocks().length > 0` and **undercounts `/emoji`**, which leaves no structural trace of its own (a plain unicode character, indistinguishable from typing one directly). |

`entry_discarded` does not exist and was not added. There is no "abandon a
blank draft" signal in the code — an unsaved draft is discarded just by
navigating away or starting another new entry, and nothing is ever created
for it to delete. Entry *deletion* (`removeEntry`/`removeEntries` in
`src/lib/repo.ts`) is a real, different action on an already-persisted entry
— worth its own event later if wanted, but it isn't "discarded" in the sense
asked for.

**Friction — paywall & checkout**

| Event | Fired from | Meaning |
|---|---|---|
| `paywall_seen` | `PaywallScreen.tsx`, `LockedScreen.tsx`, `TrialBanner.tsx` | `surface`: `'paywall'\|'locked'\|'trial_banner'` — the three places a subscribe prompt actually renders (see `src/App.tsx`). `TrialWelcome` (the post-purchase "you're in" screen) is not a subscribe surface and isn't tracked here. |
| `checkout_started` | `src/lib/subscription.ts` (`startCheckout`), `src/lib/appleIap.ts` (`purchaseApple`) | `store`: `'stripe'\|'apple'`. Centralized inside the two functions themselves, not at each of the four UI call sites (Paywall, Locked, TrialBanner, Settings) — every caller is covered automatically. |
| `checkout_failed` | same two functions | `store`; `reason`: `'cancelled'\|'error'\|'unowned'\|'other'`. **Store-asymmetric on purpose.** Stripe's redirect-based Checkout never tells the client a user cancelled — nothing in the app reads the `?checkout=cancelled` the server sets on `cancel_url` — so every Stripe failure reports `'error'`. Apple's `'cancelled'` (a real StoreKit outcome, returned not thrown) and `'unowned'` (a thrown `AppleVerifyError` carrying the cross-account code) are real, distinguishable failures. `'other'` is a defensive fallback for a thrown value that isn't even an `Error`. |
| `restore_tapped` | `src/lib/appleIap.ts` (`restoreApplePurchases`) | `store: 'apple'` — literal; there is no Stripe restore path. |
| `entitlement_stalled` | `src/App.tsx` | Stripe-only: the ~30s post-checkout webhook-wait poll gave up. No Apple equivalent — that purchase path awaits its own `verify()` call inline, with no separate stalled state. |

**Navigation / settings**

| Event | Fired from | Meaning |
|---|---|---|
| `settings_opened` | `JournalScreen.tsx` | `section`: `'appearance'\|'writing'\|'import'\|'shortcuts'\|'billing'\|'about'` — the real `SettingsTab` list (`src/lib/appHistory.ts`). There is no separate "account" tab; account actions (sign out, delete) live inside "about". Fires on the initial open and every later tab switch. |
| `theme_changed` | `ThemePicker.tsx` | `theme`: `'dawn'\|'vellum'\|'cloister'\|'sabbath'\|'plainsong'\|'vigil'` (`VoiceId`, `src/lib/voices.ts`). A "voice" is a palette + type pairing a user actually picks — not the same as the 11-value raw `ThemeId` palette enum underneath it. |
| `billing_portal_opened` | `SettingsPanel.tsx`, `LockedScreen.tsx` | Only the Stripe portal branch (`fetchPortalUrl()`) — Apple's native subscription sheet and the App Store account page are managed at Apple, not us, and aren't "our" portal. |

**Library**

| Event | Fired from | Meaning |
|---|---|---|
| `practice_library_opened` | `src/editor/practices/PracticeLibrary.tsx` | `count`: `SHELF.length`. The browse-to-begin ritual catalog — distinct from `ritual_threads_opened` ("practices you have walked", i.e. history of past use). |

Already shipped, unchanged: `surface_opened`, `slash_used`, `ritual_begun`,
`ritual_finished`, `ritual_threads_opened`, `ember_lit`, `ember_followed`,
`surface_update_recorded`, `surface_arrival_shown`, `processing_cta_clicked`.

### Exit — subscription lifecycle (server), per account

`api/_lib/growthEvents.ts` is the single place this fires from. It doesn't know
about Stripe, Apple, or RevenueCat — it only reads the plan transition every
write already computes (`current` → `next`) and decides which of three events,
if any, just happened. Called from:

- `api/_lib/updateSubscription.ts` — every write from `api/webhooks/stripe.ts`,
  `api/webhooks/apple.ts`, `api/webhooks/revenuecat.ts`, and `/api/apple/verify`.
- `api/profile/ensure.ts` — the app-managed **reverse trial** grant, which never
  touches a store webhook at all. This is the only place that trial start fires
  for the default (card-free) onboarding model.

| Event | Meta CAPI name | `source` prop |
|---|---|---|
| `trial_started` | `StartTrial` | `stripe` \| `apple` \| `reverse-trial` |
| `subscription_purchased` | `Purchase` | `stripe` \| `apple` \| `reverse-trial` |
| `subscription_cancelled` | `Cancel` | `stripe` \| `apple` \| `reverse-trial` |

Transition rules (`lifecycleEventFor` in `growthEvents.ts`, unit-tested in
`growthEvents.test.ts`): StartTrial fires entering `trialing` from anything but
`active`; Purchase fires entering `active` from anything else (first purchase,
trial conversion, win-back, dunning recovery); Cancel fires entering `cancelled`
only from a plan that was actually live (`active`/`trialing`/`past_due`) — a
duplicate or already-lapsed cancellation is silent. `shouldApplyUpdate`'s
cross-store guard runs first, so a dropped stale write never reaches this at all.

## The distinct-ID caveat — read this before building the Exit funnel

Client-side events (site **and** app) are fully anonymous — nothing calls
`posthog.identify()` anywhere, by design (the app's "Share anonymous usage"
toggle and closed vocabulary exist precisely so analytics can never carry
identity or content). Server-side Exit events use the Supabase user id as
`distinct_id`.

That means:

- **Entrance** (site) and **Use** (app) are each internally consistent —
  events within a surface share a real anonymous device id.
- **Exit alone is a real, joinable funnel** — `trial_started` →
  `subscription_purchased` share the same user-id `distinct_id`, so **Trial →
  Paid works today** as a straight PostHog funnel.
- **Entrance → Use → Exit as one continuous cross-surface funnel does not join
  today.** An anonymous site visitor's device id is never linked to the account
  they later sign into. Fixing that means calling `posthog.identify(supabaseUserId)`
  client-side after sign-in — a deliberate de-anonymization of the app's own
  analytics that this pass does not make unilaterally. Flag it as an open
  product decision, not a bug, if/when someone wants the full cross-surface view.

## Dashboards to build (PostHog UI — not code)

1. **Entrance funnel** — `landing_viewed` → `intent_clicked` → `start_trial_clicked`,
   broken down by `utm_source` / `utm_campaign`.
   Caveat: per the ship brief, ad creative currently references `/start?utm_…`
   directly — traffic from those ads skips `landing_viewed` entirely and enters
   at `start_trial_clicked`. Segment by `utm_source` rather than reading the
   funnel's first step literally, or point the ad destination at `/` instead so
   every visit gets a `landing_viewed`. Whoever owns the Meta Ads Manager
   campaign (D-030) should decide which.
2. **Retention** — a standard PostHog Retention insight keyed on `app_open`.
   That *is* what "D1/D7" means once the insight is built; no extra event
   needed. Break down by the `platform` prop to compare mac/iOS/web.
3. **Trial → Paid** — `trial_started` → `subscription_purchased`, both
   server-side (see distinct-ID note above — this one is real). Suggested
   conversion window: 16 days (14-day trial + a couple of grace days).
4. **Quality signal** — not a funnel, a computed rate: of accounts with a
   `trial_started`, what fraction have a `first_entry_created` within 24h?
   PostHog can't join these two automatically yet (see the distinct-ID caveat —
   one is server/user-id-keyed, the other is client/anonymous-device-keyed).
   Until `identify()` is wired, compute this by export rather than as a live
   PostHog insight. `minutes_to_first_entry_bucket`'s distribution (device-
   local, no join needed) is a usable interim proxy for the same question.
5. **Activation funnel** — `onboarding_step_viewed` (`step='tour'`) →
   `onboarding_step_completed` (`step='tour'`) → `onboarding_step_viewed`
   (`step='fork'`) → `onboarding_step_completed` (any step) → `entry_started`.
   Break down the fork's outcome (import vs. fresh) by segmenting on
   `onboarding_step_completed`'s next `onboarding_step_viewed` (`import` or
   `fresh`). `onboarding_skipped` (by `step`) is the drop-off view for the two
   steps that have a real skip path.
6. **Core loop volume** — `entry_started` vs. `entry_saved` per user per day/
   week, as a trend, not a funnel (a single entry can produce many `entry_saved`
   rows — see its table entry above). `entry_saved`'s `length_bucket` as a
   distribution answers "how long are people's entries", and `had_ritual` /
   `had_slash` as breakdowns answer "what fraction of entries use the craft
   features".
7. **Friction funnel** — `paywall_seen` → `checkout_started` → (no
   `checkout_failed`) as a "clean checkout" funnel, segmented by `store` and
   by `surface`. Read `checkout_failed`'s `reason` breakdown alongside it —
   remember Stripe only ever reports `'error'` (see the Friction table above),
   so a spike in Stripe `'error'` needs its own investigation rather than
   being read as "more cancels."

## Env vars

| Var | Project | Purpose |
|---|---|---|
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | root (app + `api/`) | Already existed. `growthEvents.ts` reuses it server-side via `process.env` — no new var. |
| `META_PIXEL_ID` | root (`api/`) | Server-side Meta CAPI. See `.env.example`. |
| `META_CAPI_ACCESS_TOKEN` | root (`api/`) | Meta CAPI secret. Events Manager → Settings → Conversions API. |
| `PUBLIC_POSTHOG_KEY` / `PUBLIC_POSTHOG_HOST` | `dayspring-site` (separate Vercel project) | Must hold the **same** PostHog project key as `VITE_POSTHOG_KEY` above. See `site/.env.example`. |
| `PUBLIC_META_PIXEL_ID` | `dayspring-site` | Must hold the **same** pixel id as `META_PIXEL_ID` above. |

Every one of these is unset by default. Nothing in this pass changes behavior —
no event fires, no script loads — until they're set in the relevant Vercel
project.

## Verifying

- **Meta**: Events Manager → your pixel → **Test events**, paste the site
  preview URL, click through Hero/Pricing/Footer to `/start`. Expect `PageView`
  on every page and `StartTrial` on `/start`. Trigger a trial/purchase/cancel
  against a test Stripe/Apple sandbox account to see the server-side `StartTrial`
  / `Purchase` / `Cancel` land in the same tool (they arrive as `system_generated`
  action-source events, distinguishable from the browser ones).
- **PostHog**: Activity → **Live events**, filter by event name. Site events
  show up with `utm_*` props (or none, for direct traffic); app events show up
  with the account's real (but never content-bearing) props; server Exit events
  show up with `source: stripe|apple|reverse-trial` and a `distinct_id` equal to
  the Supabase user id.

## Known limitations / explicitly out of scope for this pass

- Meta CAPI `Purchase` events carry no `value`/`currency`. Wiring the real
  Stripe/Apple price through would mean plumbing the checkout amount into
  `SubscriptionUpdate` — no invented revenue numbers here; left as a follow-up.
- `first_entry_created` and `minutes_to_first_entry_bucket` are device-local,
  not account-global (see the Activation table above) — the same known
  trade-off `surface_opened`'s `first` flag already makes elsewhere in the app.
- No cookie/consent banner was added. Meta Pixel and PostHog load unconditionally
  on the marketing site once their env vars are set. Worth a compliance pass
  before scaling spend, depending on where the ad targeting actually reaches.
- The `/` vs `/start` ad-destination question (Entrance funnel caveat above) is
  a call for whoever runs the ad campaign, not something this pass resolves.
- `entry_discarded` was requested but does not exist in the product today — no
  "abandoned a blank draft" signal exists to hang it on. See the Core loop
  section above for what a real version of it would need.
- `entry_started` carries no `source` prop, despite the original ask offering
  `'blank'\|'ritual'\|'slash'\|'import'`. Only `'blank'` (the "New entry"
  button) is a genuinely distinct "this entry began here" moment; a ritual or
  slash command beginning inside an already-blank entry is downstream of that
  same start, not a second one, and `'import'` has no single per-entry
  "started" moment at all (it's a batch job). Adding those values would have
  meant either double-counting or fabricating a distinction the code doesn't
  make.
- `entry_saved` fires on every successful autosave persist, not once per
  entry — a deliberate "track a ton now" choice (see the Core loop table
  above), not an oversight. Its `had_slash` undercounts `/emoji` for the same
  reason: the body carries no structural trace of it.
- Stripe's `checkout_failed` only ever reports `reason: 'error'` — the client
  genuinely cannot see a Stripe-side cancel today (see the Friction table
  above). Reading a change in that count as "more cancels" would be wrong;
  it's "more failures of any kind."
- `settings_opened`'s enum omits `'account'`/`'other'` from the original ask —
  there is no separate account tab in the real `SettingsTab` list; account
  actions live inside `'about'`.
- `theme_changed`'s enum is the 6 `VoiceId` values a user actually picks
  (`src/lib/voices.ts`), not the 11-value raw `ThemeId` palette enum
  underneath, and not the 5 guessed in the original ask (which also missed
  `plainsong` and `vigil`).
- `platformKind()`'s `'mac'` bucket cannot yet distinguish a Windows/Linux
  desktop build from macOS — every desktop Tauri build today is macOS-only,
  so this is inert unless that changes. See `src/lib/platform.ts`.
