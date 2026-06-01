# Insights Backfill & Processing-State Plan

**Status:** proposed (2026-05-31)
**Goal:** *Anyone who joins at any time gets insights.* A user who imports years of
history (Diarly/Day One) should have their whole archive synthesized into
weekly→monthly→quarterly→yearly rollups — not silently ignored — and the UI should
honestly say what state their insights are in.

Relates to: `docs/MULTI_TENANCY_PLAN.md` (this depends on per-owner parameterization).

---

## 1. The problem

The synthesize cron (`api/cron/synthesize.ts`, daily `0 8 * * *`) is a **forward-looking
heartbeat**: on boundary days it builds the *previous* week/month/quarter/year relative
to *now*, for a single hardcoded owner (`env.appOwnerId()`).

Two consequences:

1. **Imported history is never processed.** A new user imports 10 years of entries.
   The cron only ever looks at "last week / last month." Their decade of archive gets
   zero rollups, forever.
2. **The frontend can't tell "not computed yet" from "nothing to compute."**
   `src/lib/insights.ts` just queries rows and shows them or shows nothing.

We fix (1) with a **per-owner backfill job** triggered on import/signup, and (2) with an
explicit **status model**.

This is *additive* to the cron, not a replacement:

- **Cron** = steady-state heartbeat, keeps caught-up users fresh going forward.
- **Backfill** = one-time catch-up, walks every past period from the user's first entry
  to now.

---

## 2. What already exists (reuse, don't rebuild)

| Piece | Where | Reuse as |
|---|---|---|
| Idempotent cascade builders | `api/_lib/synthesize.ts` → `buildWeekly/Monthly/Quarterly/Yearly` | the unit of work; safe to re-run |
| Per-period on-demand build | `api/reflections/generate.ts` | the primitive the worker calls |
| Period enumeration | `api/_lib/dates.ts` → `monthsInPeriod`, `weeksOverlappingMonth` | extend with full-range enumerators |
| Import date range | `src/lib/diarlyImport.ts` → `DiarlyParseResult.dateRange` | the backfill window, free |
| Deterministic facts | `api/_lib/facts.ts` → `computeFacts` | feeds the `INSUFFICIENT_DATA` threshold |

The builders **must run in cascade order** — `buildMonthly` skips with `'no weekly
insights'` if the weeklies for that month don't exist yet. So the worker processes all
weeks first, then months, then quarters, then years.

---

## 3. The backfill engine

### 3a. New `insight_jobs` table

```sql
create table if not exists public.insight_jobs (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users (id) on delete cascade,
  kind         text not null default 'backfill',
  status       text not null default 'queued'
               check (status in ('queued','processing','done','failed')),
  window_start date not null,        -- earliest entry date
  window_end   date not null,        -- latest entry date (or import time)
  cursor       jsonb not null default '{}'::jsonb,  -- {stage, index} resume point
  total        integer not null default 0,          -- planned period count (for progress %)
  completed    integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- one active backfill per owner
create unique index if not exists insight_jobs_one_active
  on public.insight_jobs (owner) where status in ('queued','processing');
alter table public.insight_jobs enable row level security;
-- owner may READ their own job (for the UI); only the service role WRITES.
create policy "jobs readable by owner" on public.insight_jobs
  for select using (auth.uid() = owner);
```

### 3b. New date helpers (`api/_lib/dates.ts`)

`weeksInRange(start, end)`, `monthsInRange(start, end)`, `quartersInRange(...)`,
`yearsInRange(...)` — all the *complete* periods overlapping a window. (`monthsInPeriod`
/ `weeksOverlappingMonth` already give us the within-period building blocks.)

### 3c. The worker — chunked & resumable (the hard part)

A single Vercel invocation can't do ~690 model calls (timeout). So:

```
POST /api/reflections/backfill   { owner, window_start, window_end }   (Bearer CRON_SECRET)
  → creates/queues an insight_jobs row, kicks the worker

POST /api/reflections/backfill/work   { job_id }                       (Bearer CRON_SECRET)
  → loads job, processes up to BATCH (e.g. 8) periods from the cursor,
    updates cursor + completed, then:
       - if more remain → re-invoke itself (fetch, don't await) and return
       - else           → mark status='done'
```

Cursor walks the cascade in order: `weekly[]` → `monthly[]` → `quarterly[]` → `yearly[]`.
Each step calls the existing builder. Idempotent, so a re-invoked/retried batch never
duplicates.

**Re-arm options** (pick one):
- *Self-fetch* (simplest): the work endpoint fires a fresh `fetch` to itself and returns.
- *Drain cron* (most robust): a second cron every minute picks up `queued`/`processing`
  jobs and advances one batch. Survives crashes, no self-call fragility. **Recommended.**
- *QStash / Vercel queue* (most correct, new dependency): only if volume grows.

### 3d. Trigger points

- **On import completion** — `diarlyImport` flow, after entries sync, client calls
  `POST /api/reflections/backfill` with its own owner + `dateRange`.
- **On signup** (MT-2) — onboarding kicks a backfill (no-op window if no entries yet).

### 3e. Cost guardrail

A decade ≈ ~690 model calls. Log planned `total` before starting; consider a soft cap /
admin alert above N periods, and lean on a cheaper model tier for backfill weeklies if
cost bites (the cron quality bar can stay higher for fresh content).

---

## 4. The frontend status model

Four explicit states (replaces today's "row or nothing"):

| State | Condition | UI |
|---|---|---|
| `READY` | insight row exists for the period | show it |
| `PROCESSING` | an active `insight_jobs` row covers it | "Putting your reflections together…" + progress |
| `INSUFFICIENT_DATA` | entries exist but below threshold (e.g. < N days written) | "Keep writing — almost there" |
| `EMPTY` | no entries in the period | nothing / gentle nudge |

- `PROCESSING` reads `insight_jobs` (RLS lets the owner select their own). Supabase
  realtime subscription → live progress bar; common right after import, rare otherwise.
- The other three are **derivable client-side** from entry counts + existing coverage —
  no new infra. Put the threshold logic in one shared helper so backend and frontend
  agree.
- Add a `rollupState(type, periodStart)` function in `src/lib/insights.ts` returning the
  enum, and render the states in `src/features/reflections/LookingBack.tsx`.

---

## 5. Multi-tenancy coupling

Backfill is per-owner by construction, so it forces (and front-runs) the MT change of
parameterizing the synthesize path off `APP_OWNER_ID`. Once that's done, the **cron
should iterate all owners** (or each owner's daily heartbeat). Track under MT-2.

---

## 6. Phasing

- **B-1 — Engine.** `insight_jobs` table + date enumerators + `backfill` /
  `backfill/work` endpoints + drain cron. Parameterize builders off a passed `owner`.
  Test against the existing 3,460-entry Diarly archive.
- **B-2 — Trigger.** Wire import completion → backfill. Cost logging + soft cap.
- **B-3 — Frontend status.** `rollupState` helper + the 4 UI states + realtime progress.
- **B-4 — Cron multi-owner.** Fold into MT-2: heartbeat iterates all owners.

---

## 7. Open questions

- Re-arm mechanism: self-fetch vs drain-cron vs queue. (Leaning drain-cron.)
- `INSUFFICIENT_DATA` threshold — what's the minimum to make a *meaningful* weekly?
- Backfill model tier — cheaper for history, premium for fresh?
- Retroactive quarters/years that span before the user's first entry — skip partials, or
  build partial-period rollups? (Lean: only build periods with ≥1 entry, which the
  builders' `'no entries'` skip already handles.)
