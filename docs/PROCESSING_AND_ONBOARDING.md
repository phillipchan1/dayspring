# Processing & Onboarding Plan — making every intelligence surface work out of the box

**Status:** proposed (2026-06-01)
**Goal:** *Anyone who joins at any time gets a full, living app.* A user who imports
years of history gets their **reflections, scripture map, and altar** all built —
in the background, with honest progress — and every surface looks intentional
whether they have 3,000 entries, 1 entry, or none.

Supersedes / absorbs `docs/INSIGHTS_BACKFILL_PLAN.md` (which solved this for one
surface). Relates to `docs/MULTI_TENANCY_PLAN.md`: this front-runs MT by forcing
per-owner parameterization, but **does not** unblock going multi-user — see §8.

---

## 1. The problem

Three surfaces each derive intelligence from accumulated entries:

| Surface | Derived artifact | Built today by |
|---|---|---|
| **Looking Back** | weekly→monthly→quarterly→yearly rollups | `api/cron/synthesize.ts` (daily, single owner) |
| **Lamp** | `scripture_refs` (verse map) | client regex scan (`src/lib/scripture/scan.ts`) + reconcile-on-save |
| **Altar** | embeddings + harvested prayers + `prayer_threads` | `api/cron/synthesize.ts` altar steps + local scripts |

Three structural gaps, identical across all three:

1. **Imported history isn't processed.** The crons are *forward-looking* — they
   build "last week / new entries." A user who imports a decade gets nothing for
   it until something walks the archive. Today that "something" is a **local
   script I run by hand** (`backfill.ts`, `altar-backfill.ts`, `altar-harvest.ts`)
   — fine for one user, impossible for many.
2. **Single-tenant.** Every cron path is hardwired to `env.appOwnerId()`.
3. **Empty ≠ not-yet-computed.** A new user (or a 1-entry user) sees the same
   blank surface as someone whose processing simply hasn't run — which reads as
   broken.

We fix (1)+(2) with a **per-owner processing-job engine** triggered on
import/signup, and (3) with an explicit **4-state model** + an onboarding
"we're getting your account ready" experience.

This is *additive* to the crons: **cron = steady-state heartbeat** for caught-up
users; **jobs = one-time catch-up** for an archive.

---

## 2. What to reuse (don't rebuild)

| Piece | Where | Reuse as |
|---|---|---|
| Idempotent rollup builders | `api/_lib/synthesize.ts` → `buildWeekly/Monthly/Quarterly/Yearly` | reflections unit of work |
| Altar engine (all owner-scoped) | `api/_lib/altar.ts` → `embedUnembedded`, `harvestPrayers`, `threadItems`, `migrateLegacyAnswered`, `sweepOpenThreads` | altar units of work |
| Ref scanner (regex, free) | `src/lib/scripture/scan.ts` → `scanAllForRefs` | scripture unit of work (move server-side, §5) |
| Import date range | `src/lib/diarlyImport.ts` (`dateRange`), `upsertImportedEntries` | the backfill trigger + window |
| Breathing loader | `src/components/SurfaceLoader.tsx` | the PROCESSING state UI |
| Hand-run backfill scripts | `scripts/*.ts` | the bounded chunk bodies, now driven by the worker |
| `insight_jobs` design | `docs/INSIGHTS_BACKFILL_PLAN.md` | the shape we generalize below |

---

## 3. `processing_jobs` (one table for all surfaces)

```sql
create table if not exists public.processing_jobs (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in
               ('reflections','scripture','altar_harvest','altar_embed','altar_thread')),
  status     text not null default 'queued'
               check (status in ('queued','running','done','failed')),
  cursor     jsonb not null default '{}'::jsonb,  -- resume point (stage/index/last-id)
  total      integer not null default 0,          -- planned unit count, for progress %
  completed  integer not null default 0,
  attempts   integer not null default 0,
  error      text,
  locked_at  timestamptz,                          -- heartbeat for stuck-job reclaim
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one active job per (owner, kind): prevents dup work + threading races
create unique index processing_jobs_one_active
  on public.processing_jobs (owner, kind) where status in ('queued','running');
alter table public.processing_jobs enable row level security;
create policy "jobs readable by owner" on public.processing_jobs
  for select using (auth.uid() = owner);  -- service role writes; owner reads for the UI
```

---

## 4. The worker — chunked, resumable, concurrent

`POST /api/cron/process-tick` (Bearer `CRON_SECRET`), driven by a **drain cron
every ~1 min** (most robust; survives crashes — the insights plan's recommended
re-arm):

```
claim K jobs:  update processing_jobs set status='running', locked_at=now(), attempts=attempts+1
               where id in (select id from processing_jobs
                            where status in ('queued','running')
                              and (locked_at is null or locked_at < now() - interval '5 min')
                            order by created_at for update skip locked limit K)
               returning *
for each claimed job:  do ONE bounded chunk by kind (below); advance cursor + completed
                       if finished → status='done' (+ enqueue next stage); else leave 'running'
```

- **K = concurrency knob.** K *different owners* process per tick → also the
  natural OpenAI rate cap. `skip locked` guarantees no two ticks grab the same job.
- **Bounded chunk = no Vercel timeout.** Each tick does a slice and returns; the
  next tick continues. A decade-import drains over many ticks with a live %.
- **Self-healing:** `locked_at` older than 5 min ⇒ a crashed job is re-claimable.
- **Idempotent bodies** (already true): re-running a chunk never duplicates.

---

## 5. Per-kind unit of work (chunk size = the tuning knob)

| kind | chunk per tick | source fn | notes |
|---|---|---|---|
| `reflections` | ~8 periods, cascade order (weeks→months→…) | `buildWeekly/…` | needs full-range enumerators (`weeksInRange`, etc. — see insights plan §3b) |
| `scripture` | ~500 entries, parse + upsert refs | `scanAllForRefs` logic, **moved server-side** | pure regex, no model — cheap/fast |
| `altar_harvest` | ~60 entries (Nano extract) | `harvestPrayers(owner,{max})` (already chunk-capable) | the expensive one |
| `altar_embed` | ~500 rows (bulk RPC) | `embedUnembedded` | bulk-write already in place |
| `altar_thread` | whole-owner pass (fast) | `threadItems` | runs once after embed completes |

**Chaining:** `altar_harvest` → on done enqueue `altar_embed` → on done enqueue
`altar_thread`. Reflections cascades internally (its cursor walks the levels).

**Scripture decision:** today the scan runs *client-side* (free regex, no timeout)
and only when the user opens the app. To honor "close the laptop, come back when
it's ready," **move it to a server `scripture` job** so it completes unattended.
Cheap (no LLM), so it's a fast job; the in-editor reconcile-on-save stays as-is
for live writing.

---

## 6. Triggers

- **Import completion** — the Diarly/Day One flow (`upsertImportedEntries`), after
  the entries land, enqueues one job per kind for that owner over `dateRange`.
- **Signup** — onboarding enqueues the same set; with 0 entries each job is
  `total:0` → instantly `done` (no-op).
- **Steady state** — the existing daily cron stays as the caught-up heartbeat, but
  parameterized off the job/owner set instead of `APP_OWNER_ID` (§8). New writes
  are small top-ups it can do inline or via tiny jobs.

One enqueue call at import = the whole account gets built. No hand-run scripts.

---

## 7. Onboarding UX + the 4 honest states

**The "come back when it's ready" experience.** After import, a gentle one-time
banner: *"We're reading N years of your writing — your reflections, scripture map,
and altar will fill in over the next few minutes. You can start writing now."*
Reads `processing_jobs` via **Supabase Realtime**; optional "it's ready" email
(Resend already wired in `api/_lib/notify.ts`).

**Per-surface state model** (replaces today's "rows or blank"):

| State | Condition | UI |
|---|---|---|
| `READY` | artifact exists for the view | show it |
| `PROCESSING` | active `processing_jobs` row for this owner+kind | **`SurfaceLoader` + live progress** — "Gathering the prayers in your archive… 1,200 / 2,825" |
| `INSUFFICIENT` | entries exist but below a meaningful threshold | "keep writing — almost there" |
| `EMPTY` | no entries (in window) | gentle invitation, never an error |

**What "1 entry / 0 entries" looks like, per surface:**

- **Altar** — 0 prayers: *"only quiet ground — type `/pray` or `/sense`."* 1 prayer:
  a single seed stone + *"the heaps grow as you return."*
- **Lamp** — 0 refs: dark canon + *"when you write near scripture, it lights here"*
  (+ Scan CTA for imports). 1 ref: one faint chapter lit, rest at rest.
- **Looking Back** — < ~N days written: *"your first weekly reflection comes after
  a few days."* 0: a first-entry invitation.

`PROCESSING` needs the jobs table; `EMPTY`/`INSUFFICIENT` are derivable client-side
from entry counts **now** (no infra). Put each surface's threshold logic in one
shared helper so backend and frontend agree (insights plan §4).

---

## 8. Multi-tenancy

- **Kill `APP_OWNER_ID`** on the processing path: the worker iterates the job
  queue (per-owner by construction); the steady-state cron iterates owners (from
  a profiles/owners table or `distinct owner from entries`). All engine fns
  already take `owner` and write via service role with explicit `owner` — so the
  data layer is MT-ready; the RPCs (`match_entries_for_thread`,
  `set_*_embeddings`) already filter by owner.
- **The real gate is NOT this pipeline.** Going live with multiple users is still
  blocked by the **cache-purge privacy bug** in the MT plan (a logged-out/other
  user could see cached data). This work can be built + tested single-tenant
  safely; flipping multi-user waits on that fix. Keep them separate.

---

## 9. Cost & guardrails

- **Log planned `total` before starting**; soft per-owner cap + admin alert above
  N units; global daily budget; 429 backoff in the embed/Nano loops.
- A decade import ≈ scripture (free) + reflections (~hundreds of calls) + altar
  harvest (~one Nano call per 6 cued entries) + embeddings (cheap). Bounded and
  observable per job row.
- Consider a cheaper model tier for backfill vs. fresh content (insights plan §3e).

---

## 10. Phasing

- **P-1 — Engine.** `processing_jobs` + `/api/cron/process-tick` drain worker +
  range enumerators. Dispatch `reflections` + `altar_*` kinds. Parameterize off
  `owner`. Test against the existing 3,460-entry archive (it replaces the local
  scripts).
- **P-2 — Triggers.** Import-completion + signup enqueue. Cost logging + caps.
- **P-3 — States + onboarding UX.** The 4-state helpers per surface, `SurfaceLoader`
  PROCESSING wiring, realtime progress, onboarding banner. (EMPTY/INSUFFICIENT can
  ship ahead of the engine — they need no infra.)
- **P-4 — Scripture server job.** Move `scanAllForRefs` server-side as the
  `scripture` kind, so it completes unattended.
- **P-5 — Cron multi-owner.** Fold into MT: heartbeat iterates all owners. (Gated
  with the rest of MT on the privacy fix, §8.)

---

## 11. Open questions

- Re-arm: drain-cron (recommended) vs self-fetch vs a queue (QStash/Inngest) if
  volume grows.
- `INSUFFICIENT` thresholds per surface — what's the minimum for a *meaningful*
  weekly / a non-empty map / a first cairn?
- Backfill model tier — cheaper for history, premium for fresh?
- Does Scripture stay client-side (simpler, but only runs when the app is open) or
  move server-side (P-4, unattended)? Leaning server-side for the "come back when
  ready" guarantee.
- Onboarding: block nothing — let users write immediately while processing runs
  underneath (assumed yes).
