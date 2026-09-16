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

Full vocabulary lives in `src/lib/analytics.ts`. New for this pass:

| Event | Fired from | Meaning |
|---|---|---|
| `app_open` | `src/main.tsx` (`bootstrap()`) | Once per real launch. The D1/D7 retention signal. |
| `first_entry_created` | `src/lib/repo.ts` (`createEntry`) via `src/lib/firstEntry.ts` | This device's first-ever entry. Device-local "first" — same caveat as `surface_opened`'s `first` flag; a returning user's second device fires it again. |

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
2. **Use retention** — a standard PostHog Retention insight keyed on `app_open`.
   That *is* what "D1/D7" means once the insight is built; no extra event needed.
3. **Trial → Paid** — `trial_started` → `subscription_purchased`, both
   server-side (see distinct-ID note above — this one is real). Suggested
   conversion window: 16 days (14-day trial + a couple of grace days).
4. **Quality signal** — not a funnel, a computed rate: of accounts with a
   `trial_started`, what fraction have a `first_entry_created` within 24h?
   PostHog can't join these two automatically yet (see the distinct-ID caveat —
   one is server/user-id-keyed, the other is client/anonymous-device-keyed).
   Until `identify()` is wired, compute this by export rather than as a live
   PostHog insight.

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
- `first_entry_created` is device-local, not account-global (see the Use table
  above) — the same known trade-off `surface_opened`'s `first` flag already
  makes elsewhere in the app.
- No cookie/consent banner was added. Meta Pixel and PostHog load unconditionally
  on the marketing site once their env vars are set. Worth a compliance pass
  before scaling spend, depending on where the ad targeting actually reaches.
- The `/` vs `/start` ad-destination question (Entrance funnel caveat above) is
  a call for whoever runs the ad campaign, not something this pass resolves.
