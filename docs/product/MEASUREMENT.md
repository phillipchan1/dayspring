# Measurement

> **Status:** Live as of 2026-08-11. Instrumented in `src/lib/analytics.ts` (client)
> and `api/_lib/posthog.ts` (webhooks). Vendor: PostHog (US), proxied through
> `/cairn` on our own domain.

This document exists because Dayspring is unusually easy to measure badly. Nearly
every default in a consumer analytics stack — autocapture, session recording,
pageview URLs, "engagement scores" — is either a Principle 7 violation or a
Principle 1 one, and several are both. So the rule here is inverted from the
industry norm: **the burden of proof is on collecting, not on abstaining.**

---

## The rule that outranks everything below

**Nothing in this document may ever be shown to a user as a number.**

Not a streak, not a total, not a "you've written 40% more this month", not a
percentile, not a comparison to anyone else. Principles 1 and 2 forbid it and
D-006 leans permanently against it. Every count here exists so *we* can answer
four questions about the product. The moment one becomes a feature, we have
built the thing we said we would never build.

If you find yourself wanting to surface one of these, that is the signal to
re-read `PRINCIPLES.md` #1 and #2, not to write a ticket.

---

## North Star

**Weekly Returning Readers** — accounts that, in a given week, opened at least one
Return surface (Ascent, Lamp, Altar) or the Pages wall.

`VISION.md` says the promise is *"Dayspring shows you, over time, what God has been
made of you"* and that *"a journal you write in is table stakes."* If that is true,
then writing volume is the wrong North Star: it measures the table stakes. Reading
is the thing no competitor does and the thing the $7 is for.

It is also the metric that keeps us honest about **the dip** (Principle 5's
corollary). A subscription that must be worth a coffee a month in a month with
four entries can only be worth it if the retrospective surfaces keep paying out
when the writing habit doesn't. A month where writing falls and reading holds is
the product working. A month where both fall is churn arriving.

**Why not a ratio, or an "engagement score":** because a composite number is one
dashboard away from being rendered back to a user, and because a ratio hides which
half moved. Two plain counts — people who wrote, people who returned — beat one
clever one.

**What would make us change it:** if returning turns out to be dominated by a
single surface, this should become that surface's name rather than an aggregate
that averages three different jobs together.

---

## The four questions

Everything instrumented traces to one of these. An event that answers none of them
should not exist — that is the test to apply to any addition.

### 1. Do people with archives choose the import path, and does it convert better? *(D-003, D-014, VISION Bet 3)*

The reason this work exists. The veteran/fresh fork in `OnboardingFlow.tsx` has
been shipped and unread — a live persona experiment nobody was looking at.

- **Answered by:** `onboarding_path_chosen` split · the `onboarding_path` person
  property × `subscription_activated`
- **P1 predicts:** import chosen well above 40% of new signups, and import-path
  trial conversion materially beating fresh-start
- **Falsifies P1 if:** import stays cold, or importers convert *worse* — which
  would mean we set an expectation the synthesis can't meet

### 2. Can a fresh-start user reach value inside 14 days? *(D-002)*

D-002 has been open on the grounds that we are not measuring it. We are now.

- **Answered by:** fresh-branch `onboarding_completed` → `surface_opened` /
  `ascent_altitude_changed` → `subscription_activated`, over the trial window
- **The decision it feeds:** whether fresh-start needs a longer trial, a guided
  first week, a trial that starts at first reflection, or to be abandoned as an
  acquisition path

### 3. Is retrospection what people pay for, or capture? *(VISION Bet 1)*

- **Answered by:** `ascent_altitude_changed` (climbing is the strongest available
  signal — someone reaching the Summit is doing the thing the product is for),
  `surface_opened`, `pages_opened`, `ask_run` · correlated against
  `subscription_renewed` and `subscription_cancelled`
- **Falsifies Bet 1 if:** renewal tracks writing volume rather than
  reflection-surface engagement

### 4. Does the dip churn people? *(Principle 5's corollary, VISION Bet 5)*

- **Answered by:** whether `subscription_cancelled` clusters in low-reading
  periods rather than low-writing ones
- **Falsifies Bet 5 if:** churn clusters in low-entry months — meaning we only pay
  off for the already-disciplined, which is the persona we declined (P3)

Note what is deliberately **not** a question: *"which users are most engaged."*
That is a ranking of people by their spiritual practice, which is Principle 1's
definition of a verdict.

---

## What we never track

A standing list. Adding to it is cheap; removing from it needs a `DECISIONS.md`
row.

| Never | Why |
|---|---|
| Entry text, or any fragment of it | Principle 7 — the whole point |
| Ask / Find query strings | The most sensitive string in the app: what someone wants to know about their own prayer life |
| Pages filter words, subjects, concordance terms | The user's own vocabulary is user content |
| Scripture references the user wrote | Reveals what they are reading and, by inference, what they are going through |
| Arc, thread, rope or prayer names | Written by the user |
| Filenames, import file names, export names | Frequently a person's name |
| Entry ids, in any property including URLs | Would make an event re-joinable to a specific entry |
| Raw counts of user content | A precise count is a fingerprint — bucket it (`analytics/buckets.ts`) |
| Anything derived from entry *content* by a model | Laundering content through inference is still content |
| Keystroke, scroll, focus or dwell telemetry | Principle 3 — nothing on the writing path |
| Session recordings, heatmaps, autocapture | A pixel-perfect video of someone writing a confession |
| Precise location, IP-derived geography | Not needed by any of the four questions |
| A/B assignment on copy that instructs the user | Principle 2 — we do not optimise the sermon we are not preaching |

**The structural defence.** This list is a reminder, not the mechanism. Every event
property is an enum, number, or boolean, and `src/lib/analytics.ts` makes a bare
`string` a **compile error** that names the offending event. You cannot ship a
free-text property by forgetting this document.

---

## The event table

Client events live in `src/lib/analytics.ts`; server events in
`api/_lib/posthog.ts`. **Event names and property values are permanent keys** —
`GLOSSARY.md`'s rule. Renaming one orphans its history, because old rows keep the
old name and nothing reconciles them.

### Group A — the onboarding funnel *(settles D-003)*

| Event | Properties | Fires when |
|---|---|---|
| `onboarding_started` | — | The welcome carousel paints |
| `onboarding_fork_shown` | — | The veteran/fresh fork is shown — the funnel's denominator |
| `onboarding_path_chosen` | `path` | A fork card is chosen. **The D-003 event** |
| `onboarding_import_started` | `source` | An archive is handed to the parser |
| `onboarding_import_completed` | `source`, `entries`, `years` | Entries are written to the account |
| `onboarding_import_failed` | `source`, `reason` | An import ends with no entries |
| `onboarding_completed` | `path` | `onboarded_at` is stamped — the funnel's numerator |

`path` is `veteran | fresh | veteran_mobile`. The third is a real outcome the fork's
copy pretends doesn't exist: a phone user who picks "I've been journaling for years"
cannot import (a multi-hundred-MB archive would take the WKWebView down) and lands on
an apology screen. Folding it into `veteran` would claim an import that never
happened; folding it into `fresh` would hide that we turn away exactly the persona
D-014 calls the wedge. **If `veteran_mobile` is a meaningful share, that is a product
finding, not a data-cleaning problem.**

### Group B — the Return surfaces *(the North Star)*

| Event | Properties | Fires when |
|---|---|---|
| `surface_opened` | `surface`, `first` | A Return surface opens |
| `ascent_altitude_changed` | `altitude` | The Ascent moves between altitudes |
| `pages_opened` | — | The Pages wall takes the canvas |
| `ember_lit` | `surface` | A discovery ember lights for an unvisited surface |
| `ember_followed` | `surface` | A surface is first opened while its ember burns |
| `surface_update_recorded` | `surface` | A new item is recorded as unseen |
| `surface_arrival_shown` | `surface`, `kind`, `count` | An arrival line is shown |
| `processing_cta_clicked` | — | "See your Ascent →" is clicked |

`altitude` is `week | month | quarter | year` — the **internal** keys, never the
display names Valley/Hillside/Ridge/Summit. `surface` likewise uses `reflections`
(not "ascent") and `scripture` (not "lamp"). A type assertion in
`analytics.test.ts` fails to compile if these drift from `ascent.config.ts`.

### Group C — what gets written with

| Event | Properties | Fires when |
|---|---|---|
| `slash_used` | `cmd` | A slash command is chosen |
| `ritual_begun` | — | A ritual's prompts are inserted |
| `practice_begun` | `practice` | A practice is inserted |

`practice` is a `PracticeId` slug, never the display name — the names carry curly
apostrophes and get reworded, and either would split a practice's history in two.

### Group D — retrieval

| Event | Properties | Fires when |
|---|---|---|
| `ask_run` | `results`, `ok` | An Ask query runs and the wall lights |

The question is never sent, in any form, hashed or otherwise.

### Group E — the paywall

| Event | Properties | Fires when |
|---|---|---|
| `paywall_shown` | `reason` | The paywall or locked screen mounts (once) |
| `checkout_started` | `plan`, `store` | Checkout is launched — an intent, not a purchase |

### Group F — consent

| Event | Properties | Fires when |
|---|---|---|
| `usage_sharing_changed` | `enabled` | The usage toggle moves |

The `false` case is sent *before* the transport is torn down, deliberately. A
measurement system that cannot see people leaving it is measuring the wrong cohort.

### Server events *(webhooks — `api/_lib/posthog.ts`)*

| Event | Properties | Fires when |
|---|---|---|
| `subscription_activated` | `store`, `interval`, `from_trial` | Checkout completes with an active subscription |
| `subscription_renewed` | `store`, `interval` | A renewal invoice is paid |
| `subscription_cancelled` | `store`, `interval` | A subscription genuinely ends |
| `payment_failed` | `store`, `interval` | A subscription invoice fails |

These exist because nobody is looking at the app when they happen — a renewal a
year out, a card that fails at 3am, a cancellation made in Stripe's own portal.
`distinct_id` is the **Supabase auth UUID**, the same identity the browser uses.
That shared key is the entire point: it is what lets a choice made in a browser on
day 0 join to a conversion reported by a webhook on day 14.

Involuntary churn (`payment_failed`) must never be totalled with deliberate churn
(`subscription_cancelled`). One is a card that expired; the other is a person who
left. Reading them together produces a churn number that is wrong in the direction
that makes the product look worse than it is.

---

## Person properties

The only durable facts attached to a person. Same enum-only rule as events —
person properties are the easiest place in any analytics stack to accidentally
park an email address.

| Property | Values | Set by |
|---|---|---|
| `onboarding_path` | `veteran \| fresh \| veteran_mobile` | Client, at the fork |

This is what makes question 1 answerable. Which fork someone took is known only in
a browser, on day 0; whether they subscribed is known only to a webhook, weeks
later. Neither event can carry the other's fact, so the fork is written onto the
person and conversion is grouped by it afterwards.

**Deliberately not person properties:** email, name, entry count, plan tier,
"engagement level", or anything that would let a person be picked out of the
project by hand.

---

## Privacy architecture

### Consent

Everything is gated on `settings.shareUsage` (Settings → About → *Share usage
data*), which **defaults on**.

The gate is on **SDK initialisation**, not just on `track()`. This is the part
most implementations get wrong: an initialised posthog-js writes localStorage and
a cookie, mints a device id, and fetches remote config on its own schedule, none
of which routes through our code. `opt_out_capturing_by_default` suppresses the
sending *after* the SDK has already decided who someone is. So: **no consent, no
SDK, no network.** Turning the toggle off mid-session calls `reset(true)` — a new
device id, the stored person dropped — and then opts out.

Consent is driven off a `settingsStore` subscription rather than a startup read,
because `useSettingsSync` pulls remote settings after boot and remote wins. A user
who opted out on their laptop arrives on a second device with the local default.

### Identity — pseudonymous, and we say so

We `identify()` with the Supabase auth UUID. **This means usage data is
pseudonymous, not anonymous.** It is never linked to entry content and structurally
cannot be, but it is linked to an account.

The settings toggle used to read *"Share anonymous usage."* It doesn't any more,
because Principle 7's test is whether someone could read our copy, read our
architecture, and feel misled — and they could have. `public/legal/privacy.html`
names PostHog as a subprocessor and describes what is collected.

### The editor is untouched

`posthog-js` is dynamically imported at idle, after first paint. Nothing in the
analytics path runs on the CodeMirror render or input path (Principle 3). Absent
`VITE_POSTHOG_KEY` the SDK is never fetched at all.

### URLs are scrubbed twice

`get_current_url` on the way in, `before_send` on the way out — the second also
catches the `$initial_*` set that persistence replays from earlier sessions. Both
reduce a URL to its path.

This is not theoretical. Supabase OAuth returns with `#access_token=…` in the
hash, and `stripAuthUrlNoise()` only clears it from a React effect that runs
*after* the SDK can already have captured. An access token in a third party's logs
is an incident, not an untidiness. Entry ids are not in the path today — the
router only ever writes `/` or `/lamp` — but that is a property of today's router,
not a guarantee, and the scrubber is what keeps it true if that changes.

Bare hostnames (`$referring_domain`, `$host`) pass through unscrubbed: they have
no path, query or fragment to leak, and mangling them would cost the one signal
that answers which front door people arrive by (**D-001**) for no privacy gain.

### The proxy

`api_host` is `/cairn` on our own domain, rewritten to PostHog in `vercel.json`.
Two reasons: ad blockers filter `posthog.com` by domain, and the Tauri shells serve
from `*.localhost`, so a relative URL never reaches Vercel at all — `apiUrl()`
resolves to the absolute production origin there.

Three rewrites, not one, and they must sit **before** the SPA catch-all. posthog-js
computes its region from `api_host`; an unrecognised host means "custom", which
routes *every* endpoint kind — capture, remote config, and lazily loaded assets —
at `api_host + path` rather than at the region's asset CDN. Without
`/cairn/static` and `/cairn/array` the SDK 404s on its own files. The SPA catch-all
only excludes paths containing a dot, so it would otherwise answer capture requests
with `index.html`.

The path is `/cairn` rather than the conventional `/ingest`, which blockers list by
name.

---

## Operational notes

- **`VITE_POSTHOG_KEY` is baked at build time**, and desktop binaries are built in
  GitHub Actions, not on Vercel. It must be set in the Vercel project **and** in
  `release.yml` **and** `release-stable.yml`. A key set only in Vercel leaves every
  shipped `.dmg` reporting nothing, silently, for the life of that release.
- **`POSTHOG_KEY`** (no `VITE_` prefix) is the server-side twin, for webhooks.
  Absent → server events are skipped, never an error.
- **Nothing in the analytics path may throw.** The client swallows everything; the
  server path is called from Stripe and Apple webhooks, where a throw becomes a
  non-2xx, which makes the store retry, which re-runs a subscription write.
  Somebody's billing state is not worth a metric.

---

## Related

- `PRINCIPLES.md` — #1 light not verdict, #2 never gamify, #3 writing surface
  sacred, #7 private by default
- `DECISIONS.md` — D-002, D-003, D-006, D-014
- `GLOSSARY.md` — the internal-keys-are-permanent rule
- `src/lib/analytics.ts` — the vocabulary and the compile-time guarantee
