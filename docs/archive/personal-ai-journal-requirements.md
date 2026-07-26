# Personal AI Journal — Build Requirements

> ## ⚠️ ARCHIVED — HISTORICAL RECORD ONLY. DO NOT BUILD FROM THIS DOCUMENT.
>
> Archived 2026-07-26. Superseded by [`docs/product/VISION.md`](../product/VISION.md).
>
> This was the original spec for a **single-user personal tool**. Dayspring is now a
> **multi-tenant subscription product with paying beta users**. Several of its founding
> constraints are no longer true:
>
> | This doc says | Reality |
> |---|---|
> | "No other users. No multi-tenancy, sharing, or collaboration." | Multi-tenant with paying users; entry sharing is planned. |
> | "No onboarding flows, payments, ads, or analytics." | Onboarding flow + Stripe paywall ($7/mo, $64/yr, 14-day trial) shipped. |
> | "Exactly one user: me. This is the load-bearing simplifying constraint." | No longer holds. Per-tenant isolation is now a correctness requirement. |
> | "No scaling concerns. Build for exactly one user." | No longer holds. |
>
> Still accurate and worth reading: §3 (stack), §4 (editor requirements — the editor
> philosophy remains the product's soul), §5 (data model, since extended), and §6
> (temporal synthesis as the hero feature).
>
> It is kept because it records *why* the architecture looks the way it does. It is not
> a statement of current intent.

A spec for Claude Code. Single-user, private journaling app with a beautiful writing experience and an AI insight layer that surfaces patterns and highlights from free-form entries, and makes those insights consumable by external tools.

---

## 1. Goal & non-goals

**Goal:** A daily-driver journal that (a) feels great to write in, (b) quietly turns unfiltered entries into structured insights, and (c) exposes those insights so my operational "cockpit" (Notion + OpenClaw agents) can pull them.

**Non-goals — do NOT build these:**
- No other users. No multi-tenancy, sharing, social, or collaboration.
- No onboarding flows, payments, ads, or analytics SDKs.
- No end-to-end encryption (incompatible with cloud AI processing — see §6).
- No scaling concerns. Build for exactly one user.

---

## 2. User & scope

Exactly one user: me. This is the load-bearing simplifying constraint. Auth allows one Google account and rejects all others. Data model assumes a single owner — no `org`, no row-level permission matrix beyond "is it me."

---

## 3. Stack (decided)

| Layer | Choice |
|---|---|
| Frontend | React + Vite — one web codebase, packaged natively for both platforms |
| Mac (desktop) | **Tauri** wrapper — native window, full-screen takeover, offline-capable. (Capacitor is mobile-only; do NOT use it for desktop.) |
| iOS (mobile) | **Capacitor** wrapper — real native app, App Store capable, keyboard-aware |
| Auth / DB / Sync | Supabase (Postgres + Auth + Realtime), Google OAuth |
| AI | OpenAI API (accepted tradeoff: single user, API data not used for training by default) |
| Hosting | Vercel — web app + serverless API routes |

Native on both platforms is a requirement, not an afterthought. The same React app runs as a plain web app during development (fastest iteration), then ships wrapped in Tauri (Mac) and Capacitor (iOS). Three packages, one codebase.

---

## 4. Editor — highest priority, this is the soul of the app

### Writing fundamentals
- Markdown-first with live (or near-live) rendering.
- Zero perceptible input lag; instant caret and keystroke response.
- Continuous autosave — never lose a keystroke.
- Keyboard-first interaction.
- Reference feel: Stoic full-screen mode, iA Writer, Day One.

### Focus mode (core — I'm a focus-first writer)
- A dedicated distraction-free mode: everything but the text disappears.
- Optional **typewriter scrolling** (active line stays vertically centered).
- Optional **line/paragraph dimming** — non-active lines fade, only the current one is at full contrast.
- Full-screen takeover with no app chrome while writing.

### Theming — code-editor aesthetic, not soft-wellness
- A **theme system** with swappable color themes in the spirit of code editors: dark themes (e.g. One Dark, Nord, Gruvbox, Solarized), plus light/sepia/paper options.
- **Font picker** spanning monospace (e.g. JetBrains Mono, iA Writer Mono), serif, and sans options.
- User-configurable: line height, max line width, font size. Settings persist per device.

### Responsive layout — desktop and mobile are deliberately different
- **Desktop (Mac):** "use the full screen" = a centered writing column with deep margins, not a screen packed with panels. Browsing/reading shows optional side panels (entry list, calendar, search); the moment I write, they hide and the column takes over. True full-screen.
- **Mobile (iOS):** always single-column. Keyboard-aware layout, thumb-reachable controls, minimal chrome, swipe gestures for navigation.
- Same app, two layouts — not a shrunk desktop on mobile.

---

## 5. Data model

- **entries**: `id`, `created_at` (original entry date — see §7), `updated_at`, `body_markdown`, `title` (optional/derived), `mood` (optional), `tags[]`, `word_count`, `source` (native | day_one | other), `external_id` (the source app's own entry ID, for dedup; null for native).
- **insights**: `id`, `entry_id` (nullable — null for period summaries), `type` (per_entry | weekly | monthly | yearly | win), `lens` (e.g. gain, gratitude, spiritual, work, trading, family), `period_start`, `period_end`, `source_ids[]` (the entries or child insights this rolls up — see §6), `content_markdown`, `structured_payload` (JSON — atomic, machine-consumable), `source_model`, `created_at`, `pushed` (bool).
- **attachments** (Phase 2): `id`, `entry_id`, `type` (image | audio), `storage_path`. Stored in Supabase Storage.
- **prompts**: editable prompt templates I control, keyed by insight type/lens.

Encryption: DB encrypted at rest (Supabase default), TLS in transit. No client-side E2E (plaintext required for API processing).

---

## 6. AI / insight layer

The writing, reading, and search experience is table stakes. **Temporal synthesis is the hero feature** — the value compounds as the window widens (week → month → year). The year-in-review is the payoff.

### Two tiers

1. **Per-entry hook (light).** On save, capture/acknowledge wins from the entry. Deliberately minimal — its job is retention (keep me writing long enough to earn the big retrospectives), not deep analysis. Avoid horoscope mush; reference specifics from the actual entry.
2. **Temporal synthesis (the hero).** Scheduled jobs that produce **weekly, monthly, and yearly** retrospectives. Day-level synthesis is intentionally out of scope — too small to contain a pattern.

### Compounding rollup architecture (important)

Do NOT re-read all raw entries for every window — too expensive and lossy. Insights cascade upward:
- **Weekly** synthesis reads the raw entries from that week.
- **Monthly** synthesis reads the **weekly summaries** (not raw entries).
- **Yearly** synthesis reads the **monthly summaries**.

Each `insights` record links to the children it summarizes (`source_ids[]`). This keeps token cost bounded and makes the year-in-review actually buildable.

### Cold-start

Month/year views need data to exist. Until enough history accumulates, show only what's available (the per-entry hook + the first weekly), and surface the larger retrospectives as they unlock. Don't render empty/synthetic month or year views.

### Requirements

- Prompts are stored and editable by me (the `prompts` table). I control inputs and outputs.
- Configurable reflection **lenses** — I pick which apply (e.g. Gain, gratitude, spiritual/scripture, work/PM, trading discipline, family).
- Insights are persisted and accumulate.
- Every insight writes a `structured_payload` (atomic JSON) alongside prose, so the cockpit can route it.

### First concrete lens: The Gain (from *The Gap and the Gain*)

The framework, as AI instructions (not quoting the book): measure backward against a former self, never forward against an ideal. The ideal keeps you in the Gap (never enough); backward measurement reveals the Gain (real, visible progress).

- **Per-entry hook:** "Pull 2–3 concrete wins or points of forward movement from today's entry, however small, measured against an ordinary day — not against any ideal. If the writer is measuring against where they think they 'should' be, gently reframe it as backward progress using specific evidence from the entry."
- **Weekly/monthly/yearly synthesis:** "Compare this period against the prior period. Describe concretely how the writer has *gained* — what changed, what was learned, what moved — measured against their former self, never against a goal. Cite specific evidence. Flag any chronic comparison-to-an-ideal as a Gap pattern to watch. End the yearly review with the throughline: who they were a year ago vs. now."
- **Structured daily capture:** a lightweight *3 wins today / 3 wins I want tomorrow* block. The AI pre-fills candidate wins from the entry; I edit. These become clean, atomic `win` records the cockpit can consume.

---

## 7. Data import & historical backfill

I have years of existing entries (Day One + a second app). Importing them solves cold-start and lets the retrospectives ship immediately instead of accruing over a year.

**Importer (single-user, keep it simple — an admin-only route or a one-off script, not a polished UI):**
- Parse each source and normalize into the `entries` shape. Target **Day One JSON export** first (`creationDate` → `created_at`, `text` → `body_markdown`, `tags` → `tags`, entry UUID → `external_id`, `source = day_one`). Add a generic **Markdown-folder** importer for the second app (confirm its actual export format first — likely markdown or CSV).
- **Preserve original timestamps.** `created_at` is the source entry's original date, never the import date. Non-negotiable — every temporal rollup depends on it.
- **Idempotent.** Dedup on (`source`, `external_id`); re-running import never creates duplicates.
- Photos/media: skip on first pass (Phase 4) — import text + dates + tags now.

**Historical backfill (the payoff):**
- After import, run synthesis across the full history using the §6 compounding architecture (weeks → months → years). This generates the multi-year retrospective and year-in-review on day one.
- This is a known, one-time API cost. Bounded by the rollup design, but run it deliberately (a single backfill job), not automatically on every import.

---

## 8. Cockpit / external integration — the ambition

Insights must be reachable by external tools:
- **Queryable in Supabase** — the `insights` table is API-accessible by default.
- **Push to Notion** — write selected insights to a Notion database (Life OS) via the Notion API.
- **Pull endpoint** — a simple authenticated REST endpoint/webhook my OpenClaw agents can hit.

Design insights as structured, atomic records (not prose blobs) so the cockpit can act on them programmatically.

---

## 9. Sync & auth

- Cross-device sync via Supabase (Realtime or fetch-on-focus). Last-write-wins is acceptable (single user). Cache locally, sync on reconnect.
- Google OAuth via Supabase. Allow exactly one account (mine); reject all others.

---

## 10. Phasing

Importing history (§7) means the retrospectives no longer have to wait for data to accumulate — sequence shifts accordingly.

- **Phase 1 (MVP / weekend):** editor + markdown + autosave + clean reading/search of past entries, Supabase entries, Google login, cross-device sync, light per-entry win-capture hook.
- **Phase 2:** the importer (§7) + Day One backfill, weekly synthesis, the Gain lens, configurable prompts/lenses. Scheduling via **Vercel cron** for v1 (note: free tier caps frequency ~daily — fine here; verify current limits). Consolidate scheduling into OpenClaw later once there's more than one scheduled job.
- **Phase 3:** monthly + yearly rollups and the year-in-review — buildable immediately once history is imported, not a year out. Notion + cockpit export.
- **Phase 4:** multimedia attachments (incl. imported photos), voice capture, Tauri/Capacitor native wrappers if PWA typing feel falls short.
