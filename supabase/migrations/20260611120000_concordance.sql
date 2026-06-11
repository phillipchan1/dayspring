-- concordance — the fidelity record: how to RENDER the writer faithfully.
--
-- One row per distinct entity/term per owner: proper nouns, name spellings,
-- aliases, domain vocabulary, who-someone-is (identity only). It NEVER stores
-- conclusions about the user — no moods, traits, themes, or anything
-- evaluative. Mirrors scripture_refs on purpose: confidence + status
-- (suggested/confirmed), provenance, and ORIGINAL entry dating (first_seen /
-- last_seen come from entries.created_at — the source date — never row time).
--
-- DARK this phase: population runs silently; no feature reads these tables.
--
-- Derived, not authoritative: concordance_events is the append-only ground
-- truth (machine 'observe' rows + user corrections); rebuildConcordance()
-- replays it into concordance_shadow to prove the live table is regenerable.

create table if not exists public.concordance (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('person','place','org','project','term')),
  canonical        text not null,             -- the correct/display form ("Esther", "NQ")
  surface_forms    text[] not null default '{}', -- observed variants & aliases ("Es", "my wife")
  descriptor       text,                      -- IDENTITY ONLY ("wife", "futures ticker") — never sentiment
  confidence       real not null default 0.4, -- 0..1; user confirm/correction pins to 1.0
  status           text not null default 'suggested'
                     check (status in ('suggested','confirmed','dormant','superseded')),
  source           text not null check (source in ('import','repetition','correction','explicit')),
  occurrence_count int  not null default 0,   -- DISTINCT entries (mirror the Lamp heat rule), not raw mentions
  first_seen       timestamptz,               -- from entries.created_at (original/source date)
  last_seen        timestamptz,               -- from entries.created_at — imports backfill old dates
  effective_start  date,                      -- period-correctness
  effective_end    date,                      -- set on supersede/retire — never deleted
  superseded_by    uuid references public.concordance (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Soft identity for ACTIVE rows: one (owner, kind, lower(canonical)) that isn't
-- superseded. A changed fact creates a NEW row and retires the old via
-- superseded_by + effective_end — supersede, never overwrite — so retired rows
-- escape the index and history stays honest.
create unique index if not exists concordance_active_identity
  on public.concordance (owner, kind, lower(canonical))
  where status <> 'superseded';

create index if not exists concordance_owner_status
  on public.concordance (owner, status);

drop trigger if exists concordance_set_updated_at on public.concordance;
create trigger concordance_set_updated_at
  before update on public.concordance
  for each row execute function public.set_updated_at();

alter table public.concordance enable row level security;

-- Owner-only, identical shape to entries/scripture_refs. The drawer's
-- confirm/edit/forget write under RLS; the service role (extraction, cron,
-- rebuild) bypasses and sets `owner` explicitly.
drop policy if exists "concordance is private to owner" on public.concordance;
create policy "concordance is private to owner"
  on public.concordance
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- ── occurrences — which DISTINCT entries an item was seen in ────────────────
-- Ground truth for occurrence_count + first_seen/last_seen: the unique pk makes
-- "increment only for a new distinct entry" exact and idempotent (re-scans and
-- racing passes can never double-count). entry_created_at is denormalized from
-- entries.created_at (the original/source date), like scripture_refs.
create table if not exists public.concordance_occurrences (
  concordance_id   uuid not null references public.concordance (id) on delete cascade,
  entry_id         uuid not null references public.entries (id) on delete cascade,
  owner            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_created_at timestamptz not null,
  primary key (concordance_id, entry_id)
);

create index if not exists concordance_occurrences_owner_entry
  on public.concordance_occurrences (owner, entry_id);

alter table public.concordance_occurrences enable row level security;

-- Owner-writable so a drawer edit (supersede flow) can repoint occurrences to
-- the successor row under RLS.
drop policy if exists "concordance_occurrences are private to owner" on public.concordance_occurrences;
create policy "concordance_occurrences are private to owner"
  on public.concordance_occurrences
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- ── events — append-only provenance log (the derivability guarantee) ────────
-- 'observe' rows are machine observations (an LLM-proposed candidate accepted
-- by the deterministic merge — traceable to the entry it came from); the rest
-- are user corrections from the drawer. rebuildConcordance() replays this log,
-- so nothing is "known" that isn't traceable to something the user wrote or
-- confirmed. Append-only even for the owner (no update/delete policies).
create table if not exists public.concordance_events (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action           text not null check (action in ('observe','confirm','edit','forget','add')),
  kind             text not null check (kind in ('person','place','org','project','term')),
  canonical        text not null,             -- target identity at event time
  entry_id         uuid references public.entries (id) on delete set null, -- observes only
  entry_created_at timestamptz,               -- original entry date, survives entry deletion
  payload          jsonb not null default '{}', -- observe: {surface_form, descriptor?, source}
                                               -- edit: {new_canonical?, surface_forms?, descriptor?}
  created_at       timestamptz not null default now()
);

create index if not exists concordance_events_owner_seq
  on public.concordance_events (owner, created_at);

alter table public.concordance_events enable row level security;

drop policy if exists "concordance_events readable by owner" on public.concordance_events;
create policy "concordance_events readable by owner"
  on public.concordance_events
  for select
  using (auth.uid() = owner);

drop policy if exists "concordance_events insertable by owner" on public.concordance_events;
create policy "concordance_events insertable by owner"
  on public.concordance_events
  for insert
  with check (auth.uid() = owner);

-- ── shadow — rebuild target ──────────────────────────────────────────────────
-- rebuildConcordance() wipes and regenerates an owner's Concordance here purely
-- from entries + the event log, proving the live table is derived, not
-- authoritative. Same shape as concordance; service-role writes, owner reads.
create table if not exists public.concordance_shadow (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('person','place','org','project','term')),
  canonical        text not null,
  surface_forms    text[] not null default '{}',
  descriptor       text,
  confidence       real not null default 0.4,
  status           text not null default 'suggested'
                     check (status in ('suggested','confirmed','dormant','superseded')),
  source           text not null check (source in ('import','repetition','correction','explicit')),
  occurrence_count int  not null default 0,
  first_seen       timestamptz,
  last_seen        timestamptz,
  effective_start  date,
  effective_end    date,
  superseded_by    uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.concordance_shadow enable row level security;

drop policy if exists "concordance_shadow readable by owner" on public.concordance_shadow;
create policy "concordance_shadow readable by owner"
  on public.concordance_shadow
  for select
  using (auth.uid() = owner);

-- ── entries watermark ────────────────────────────────────────────────────────
-- An entry's prose is read by the extraction model at most once (mirror of
-- prayer_scanned_at). The partial index serves the "what's left to scan" pool.
alter table public.entries add column if not exists concordance_scanned_at timestamptz;

create index if not exists entries_concordance_unscanned
  on public.entries (owner, created_at)
  where concordance_scanned_at is null;

-- ── processing job kind ──────────────────────────────────────────────────────
-- The import-time seed drains through the existing per-owner job engine.
alter table public.processing_jobs drop constraint if exists processing_jobs_kind_check;
alter table public.processing_jobs add constraint processing_jobs_kind_check
  check (kind in ('reflections','scripture','altar_harvest','altar_embed','altar_thread','concordance'));
