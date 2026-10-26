# Dayspring — Supabase / Vercel inventory

Prepared for the Cloudflare Workers + Neon Postgres + Better Auth migration.
**Authoritative schema is `supabase/migrations/`** (47 files). `supabase/schema.sql`
lags (missing payment columns, gather stamps, quarterly insights, per-owner import
dedup, and later tables).

This document is a map, not a cutover. Production stays on Supabase + Vercel until
an explicit env flag (`VITE_BACKEND=workers` or a `workers.dev` `VITE_API_BASE_URL`)
is set. See [cutover.md](./cutover.md).

---

## Tenancy model

Almost every user table has **`owner uuid`** → `auth.users(id) ON DELETE CASCADE`
(default `auth.uid()`). RLS is `auth.uid() = owner` (FOR ALL unless noted).

Server jobs use **`supabaseAdmin()`** (`SUPABASE_SERVICE_ROLE_KEY`) and **bypass
RLS**. They must set `owner` explicitly. After Neon, that bypass is gone: every
Worker query has to carry the session (or cron) owner itself.

Guest mode is **not** Supabase anonymous auth. `src/lib/guestOwner.ts` stores
`local:<uuid>` in localStorage. Guest writes stay on-device. No `supabase.from()`
for guest-owned journal sync.

---

## 1. Tables (27 public)

| Table | Owner | RLS | Notes |
|---|---|---|---|
| `entries` | `owner` | owner FOR ALL | Journal. Unique `(owner, source, external_id)`. Embedding `vector(1536)` is server-only. `body_hash` generated. Gather stamps. Realtime publication **without** `embedding`. |
| `insights` | `owner` | owner FOR ALL | Period rollups. Partial unique `(owner, type, period_start, period_end)` for weekly/monthly/quarterly/yearly. |
| `profiles` | `owner` unique | owner FOR ALL | Welcome, Stripe, Apple IAP, trial, settings jsonb, app_lock, scripture watermark, processing ack. |
| `spiritual_items` | `owner` | owner FOR ALL | prayer / sense / scripture. Embeddings, thread_id, char offsets. |
| `reminders` | `owner` | owner FOR ALL | `remind_at`, `fired`. |
| `echo_candidates` | `owner` unique | owner FOR ALL | Weekly echo pick. |
| `echo_dismissals` | `owner` | owner FOR ALL | |
| `resurface_dismissals` | `owner` | owner FOR ALL | |
| `scripture_refs` | `owner` | owner FOR ALL | OSIS + offsets + status. Trigger `sync_scripture_ref_dates`. |
| `scripture_text` | **none** | enabled, **no policies** | Global ESV cache. Service role only. Never client. |
| `prayer_threads` | `owner` | owner FOR ALL | Altar cairns / subjects. |
| `encounters` | `owner` | owner FOR ALL | `thread_id` and later `thread_ref`. |
| `altar_candidates` | `owner` | owner FOR ALL | One per thread. |
| `altar_candidate_dismissals` | `owner` | owner FOR ALL | Unique `(owner, thread_id, entry_id)`. |
| `item_subjects` | `owner` | owner FOR ALL | Server-only M2M. |
| `threads` | `owner` | owner FOR ALL | Ascent / declared threads. |
| `ropes` | `owner` | owner FOR ALL | |
| `thread_members` | via `threads.owner` | join policy | `id` PK; `entry_id` nullable; optional `spiritual_item_id`. |
| `attachments` | `owner` | owner FOR ALL (`authenticated`) | Unique `(owner, hash)`. `storage_key` = `<owner>/<hash>.<ext>`. |
| `processing_jobs` | `owner` | **SELECT only** | Unique one active job per `(owner, kind)`. Realtime. |
| `concordance` | `owner` | owner FOR ALL | |
| `concordance_occurrences` | `owner` | owner FOR ALL | |
| `concordance_events` | `owner` | SELECT + INSERT | Client cannot update/delete. |
| `concordance_shadow` | `owner` | **SELECT only** | Rebuild staging. |
| `marks` | `owner` | owner FOR ALL | Unique `(entry_id, md5(quote))`. |
| `kept_subjects` | `owner` | owner FOR ALL | Unique `(owner, subject_key)`. |
| `welcome_drip_enrollments` | PK `owner` | enabled, **no client policies** | Service role only. |

### `entries` effective columns

`id`, `owner`, `created_at`, `updated_at`, `body_markdown`, `title`, `mood`,
`tags text[]`, `word_count`, `source` (`native`/`day_one`/`diarly`/`other`),
`external_id`, `circumstances jsonb`, `embedding vector(1536)`, `superseded`,
`entry_lens`, `entry_domain`, `prayer_scanned_at`, `concordance_scanned_at`,
`body_hash` (generated `md5(body_markdown)`), `gathered_hash`,
`gathered_words_hash`, `gather_attempts`.

Trigger `entries_touch_updated_at()`: embedding / gather stamps must **not** bump
`updated_at` (multi-device sync).

### `profiles` effective columns

Base: `id`, `owner`, `has_seen_welcome`, `created_at`, `updated_at`.

Added: `stripe_customer_id`, `apple_original_txn` (**unique**), `plan`,
`plan_source`, `trial_ends_at`, `plan_expires_at`, `feature_flags text[]`,
`scripture_scan_watermark`, `settings jsonb`, `onboarded_at`,
`apple_product_id`, `apple_environment`, `apple_last_txn_id`, `apple_updated_at`,
`acked_processing_completion`, `app_lock jsonb`.

---

## 2. Storage

| Item | Detail |
|---|---|
| Bucket | `attachments` — private, 50 MB/file, image MIME allowlist |
| Created | `supabase/migrations/20260603050000_attachments.sql` |
| Object key | `<owner-uuid>/<sha256>.<ext>` |
| Storage RLS | `storage.objects` insert/select/delete: `bucket_id = 'attachments'` and folder prefix = `auth.uid()::text` |

Client (`src/lib/attachments.ts`): `upload`, `createSignedUrl` (+ transform), `download`.

Server (`api/account/delete.ts`): `list(ownerId)` + `remove(keys)` before `auth.admin.deleteUser`.

No other buckets.

**Neon replacement:** Cloudflare R2 (10 GB free) + Worker-issued signed URLs.
Path prefix must stay owner-scoped in the Worker — storage RLS will not exist.

---

## 3. Realtime

| Publication | Tables | Payload |
|---|---|---|
| `supabase_realtime` | `entries` | Column list **without** `embedding`; includes `circumstances` |
| `supabase_realtime` | `processing_jobs` | Full row |

Client channels:

- `src/lib/entriesRealtime.ts` — `postgres_changes` on `entries`, event `*`
- `src/hooks/useProcessingJobs.ts` — `processing_jobs` filtered `owner=eq.${owner}`

`api/realtime-token.ts` is **OpenAI Realtime transcription**, not Supabase Realtime.

**Neon replacement:** polling, SSE from the Worker, or Durable Objects. Not in
this PR's client path (flag off keeps Supabase channels).

---

## 4. Auth flows

### Client (`src/lib/supabase.ts`)

`createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` — PKCE,
`persistSession`, `autoRefreshToken`, `detectSessionInUrl` only on OAuth callback.
Tauri (desktop **and** iOS) uses `src/lib/authStorage.ts` (plugin-store `auth.json`).

Session (`src/lib/sessionStore.ts`): boot from stored session first (offline-first).
`onAuthStateChange` — only explicit `SIGNED_OUT` or a validated-invalid user
clears the session.

### Providers (`src/lib/auth.ts`)

| Method | Call |
|---|---|
| Google / Apple | `signInWithOAuth` |
| Email | `signInWithPassword` / `signUp` |
| Link second provider | `linkIdentity` + `getUserIdentities` |
| PKCE finish | `exchangeCodeForSession` |
| Sign out | `getSession` then `signOut({ scope: 'local' })` |

Redirect: web = `window.location.origin`; native =
`https://dayspring-eosin.vercel.app/auth/callback` → `dayspring://auth-callback`.

No app-side email allowlist. Access = OAuth + RLS.

### Server JWT validation

`api/_lib/userAuth.ts` → `supabaseAdmin().auth.getUser(token)`.

Admin: `auth.admin.listUsers`, `getUserById`, `deleteUser`
(`api/account/delete.ts`, crons, growth events, scripts).

`supabase/config.toml` also names Apple + Twilio SMS secrets for hosted Auth
(not used by the Vite app directly).

---

## 5. Client `supabase.from()` / `rpc` / `storage` / `auth`

### By table

| Table | Ops | Primary files |
|---|---|---|
| `entries` | select, insert, update, delete, upsert | `src/lib/entries.ts` (paginate / `gt(updated_at)` / import upsert `onConflict: owner,source,external_id`); scripture scan; subscription counts |
| `insights` | select, update | `src/lib/insights.ts`, `processingClient.ts` |
| `profiles` | select, update, upsert | `profile.ts`, `appLockStore.ts`, `subscription.ts`, scripture watermark |
| `spiritual_items` | CRUD | `spiritual.ts`, `echoes.ts`, `altar/*` |
| `scripture_refs` | select, insert, delete | `src/lib/scripture/{capture,confirm,query,scan}.ts` |
| `reminders` | select, insert, update | `reminders.ts`, `echoes.ts` |
| `attachments` | select, upsert, update | `attachments.ts`, `photoLooks.ts`, `export/exportEntries.ts` |
| `marks` | select, upsert, delete | `marks.ts` |
| `kept_subjects` | select, upsert, delete | `keptSubjects.ts`, `lifemap/useLifeMap.ts` |
| `concordance` | select, update | `concordance.ts`, `useLifeMap.ts` |
| `concordance_events` | insert | `concordance.ts` |
| `concordance_occurrences` | select | `concordance.ts` |
| `echo_*`, `resurface_dismissals` | select, insert, delete | `echoes.ts` |
| `prayer_threads`, `encounters`, `altar_*` | select, update, delete | `src/lib/altar/*` |
| `threads`, `ropes`, `thread_members` | select | `features/threads/data`, `altar/data.ts`, `ascent/ledger/load.ts` |
| `processing_jobs` | select | `useProcessingJobs.ts` — `.eq('owner')` |

**RPC:** `upsert_entry_checked` — `src/lib/entries.ts` (optimistic concurrency).

**Never from client:** `item_subjects`, `concordance_shadow`, `scripture_text`,
`welcome_drip_enrollments`.

### Auth call sites (`src/`)

`auth.ts`, `sessionStore.ts`, plus `getSession` / `getUser` in entries, spiritual,
profile, reminders, marks, echoes, subscription, onboarding, noticing,
appLockStore, appleIap, feedback, account, api, export, altar, scripture scan,
JournalScreen, PhotoStrip, readAttachments, InlineImagePopover, SpanPhotos,
Cover, attachments, photoLooks, crashReport, editor attachment extensions,
ImportRunner.

---

## 6. Vercel API routes

All files under `api/` (Vite + Vercel serverless). `vercel.json` maps path → file.
SPA rewrite skips `/api/*`.

### Cron (`Authorization: Bearer ${CRON_SECRET}`)

| Route | Schedule | Work | CPU risk on Workers Free |
|---|---|---|---|
| `/api/cron/synthesize` | `0 8 * * *` | Per-owner rollups, altar harvest/embed, concordance, declared subjects | **Will exceed 10 ms CPU.** Today `maxDuration: 300`. |
| `/api/cron/process-tick` | `* * * * *` | Claim/drain `processing_jobs`, gather enqueue | **Will exceed 10 ms CPU.** Self-chains. |
| `/api/cron/remind` | `0 9 * * *` | Due reminders + Resend | Borderline (list users + send). |
| `/api/cron/sync-resend` | `15 9 * * *` | Auth emails → Resend audience | List-users loop. |
| `/api/cron/welcome-drip` | `30 9 * * *` | Welcome steps (sends gated `WELCOME_DRIP_SENDS_ENABLED`) | OK if evaluate-only; send is I/O. |
| `/api/cron/echoes` | `0 10 * * 1` | Weekly echo candidate | Embed / insight compare — **CPU risk**. |

### User JWT (`getAuthedUser`)

| Route | Purpose | CPU risk |
|---|---|---|
| `POST /api/profile/ensure` | Profile + reverse trial + drip enroll | Low |
| `POST /api/processing/enqueue` | Backfill jobs after import | Low (enqueue only) |
| `POST /api/stripe/checkout` | Stripe Checkout | **Stay on Vercel** (billing) |
| `GET /api/stripe/portal` | Customer portal | **Stay on Vercel** |
| `POST /api/trial/extend` | +7 day trial | Low |
| `POST /api/apple/verify` | StoreKit 2 JWS → profiles | **Stay on Vercel** (IAP) |
| `DELETE /api/account/delete` | Cancel Stripe, wipe storage, delete user | Medium (storage list) |
| `POST /api/ask` | RAG over entries (`match_entries*`) | **Will exceed 10 ms CPU** (`maxDuration: 60`) |
| `POST /api/keeping/read` | Private evaluative read | **CPU / LLM** |
| `POST /api/onboarding/backfill` | Historical rollup after import | **CPU** |
| `POST /api/pages/interpret` | NL → page filters | **LLM** |
| `POST /api/circumstances/snap` | Reverse-geocode / weather | I/O |
| `POST /api/transcribe` | Audio → SSE | **Will exceed 10 ms CPU** (`maxDuration: 300`) |
| `POST /api/transcribe-image` | Handwriting vision | **LLM** |
| `POST /api/realtime-token` | OpenAI Realtime secret | Low |
| `POST /api/feedback` | GitHub issue | I/O |
| `POST /api/spiritual/*` | Scripture / ESV / notice | ESV I/O; notice is LLM |

### Cron-secret admin

`POST /api/reflections/generate`, `POST /api/concordance/rebuild`,
`POST /api/admin/welcome-drip-backfill`.

### Webhooks — **do not move in this PR**

| Route | Auth | Notes |
|---|---|---|
| `POST /api/webhooks/stripe` | Stripe signature | Production URL is live |
| `POST /api/webhooks/apple` | App Store Server Notifications V2 | ASC dashboard points at Vercel |
| `POST /api/webhooks/revenuecat` | shared secret | Legacy |

Worker stubs exist so the path is reserved. They do **not** replace Vercel.
Do not change DNS, ASC notification URLs, or Stripe endpoints.

---

## 7. Postgres functions / RPC

| Function | Callers |
|---|---|
| `set_updated_at()` | triggers |
| `entries_touch_updated_at()` | entries trigger |
| `upsert_entry_checked(...)` | client `entries.ts` |
| `sync_scripture_ref_dates()` | scripture_refs trigger |
| `match_entries_for_thread` | `api/_lib/altar.ts` |
| `set_entry_embeddings` / `set_item_embeddings` | altar |
| `altar_field` | server |
| `claim_processing_jobs(k)` | `api/_lib/processing.ts` |
| `match_entries` / `match_entries_lexical` | `api/ask.ts` |
| `reconcile_scanned_items` | altar |
| `gather_pending_owners` / `gather_pending_count` / `gather_pending_entries` / `gather_stamp` | gather engine |

Most match functions are `SECURITY DEFINER` with an explicit `owner_id` argument.

**Extensions:** `vector` (pgvector, 1536-d). Neon Free supports it; PGlite isolation
in this PR stores embeddings as optional `text` so CI does not need the extension.

---

## 8. Environment variables

### Client (Vite)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (empty on web
→ same-origin `/api`; Tauri defaults to `https://dayspring-eosin.vercel.app`),
PostHog, onboarding flags, Apple product ids, `VITE_BACKEND` (**new**, default unset).

### Server (Vercel today)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
`ESV_API_KEY`, `CRON_SECRET`, `RESEND_*`, `WELCOME_DRIP_*`, `GITHUB_TOKEN`,
`ONBOARDING_REQUIRE_CARD`, Apple IAP (`APPLE_*` — **In-App Purchase** key, not
the ASC upload key), `REVENUECAT_WEBHOOK_SECRET`, `META_*`, Stripe keys.

### iOS / desktop CI

`VITE_SUPABASE_*` secrets. iOS **now** reads `VITE_API_BASE_URL` from a GitHub
**Actions variable** (fallback remains the Vercel origin). Signing: see
`docs/IOS.md` and [cutover.md](./cutover.md).

---

## 9. How the inert flag works

| Build | Flag off (today / production) | Flag on |
|---|---|---|
| Web (Vercel) | Relative `/api/*` + Supabase PostgREST + Supabase Auth | `VITE_BACKEND=workers` and/or `VITE_API_BASE_URL=https://<worker>.workers.dev` |
| Desktop Tauri | `VITE_API_BASE_URL` baked to Vercel | Same Worker URL at build time |
| iOS IPA | Repo variable empty → Vercel | Repo variable set to the workers.dev origin |

`isWorkersBackend()` is true only for `VITE_BACKEND=workers|cloudflare` or an API
base whose host is `*.workers.dev`. A Vercel URL is **not** Workers. Existing
`https://dayspring-eosin.vercel.app` desktop/iOS builds are unchanged.

While the flag is off, **no client module talks to the Worker**. Journal sync,
auth, storage, and realtime stay on Supabase. Vercel crons stay on Vercel.

---

## 10. Scripts that assume Supabase

`scripts/embed-entries.ts`, `backfill*.ts`, `dedupe-*.ts`, `derive-threads.ts`,
`grant-review-access.ts`, `expire-trial.ts`, `_owner.ts`, and others import
`SUPABASE_*`. Out of scope for this PR (no prod data, no dumps).
