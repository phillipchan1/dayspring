-- Dayspring — Supabase schema
-- Run this in the Supabase SQL editor (SQL Editor → New query → paste → Run).
-- Phase 1 only creates `entries`. The insights / prompts / attachments tables
-- come in later phases.

-- ── entries (§5) ──────────────────────────────────────────────────────────
create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(), -- original entry date (preserved on import)
  updated_at    timestamptz not null default now(),
  body_markdown text not null default '',
  title         text,
  mood          text,
  tags          text[] not null default '{}',
  word_count    integer not null default 0,
  source        text not null default 'native' check (source in ('native', 'day_one', 'diarly', 'other')),
  external_id   text
);

-- Dedup target for idempotent imports (§7): (source, external_id) is unique.
-- The index is intentionally NOT partial — Supabase upserts pass a bare
-- onConflict: 'source,external_id', and Postgres can only infer a non-partial
-- index from a bare column list. Native rows carry a null external_id, and
-- nulls are distinct in a unique index, so they are never deduped against each
-- other.
create unique index if not exists entries_source_external_id_key
  on public.entries (source, external_id);

create index if not exists entries_created_at_idx on public.entries (created_at desc);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────
-- Single-user app, but the anon key is public, so the table MUST be protected.
-- Policy: a signed-in user may only see/modify their own rows. Combined with the
-- app-side email allowlist, only your Google account ever has a session at all.
alter table public.entries enable row level security;

drop policy if exists "entries are private to owner" on public.entries;
create policy "entries are private to owner"
  on public.entries
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- ── insights (§5) ──────────────────────────────────────────────────────────
-- Grounded rollups (weekly → monthly → quarterly → yearly). Facts are computed in
-- code; quotes/excerpts/Ebenezer pairings are verbatim-validated; the reflective
-- prose is generated and grounded by feeding only the level beneath.
create table if not exists public.insights (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id          uuid references public.entries (id) on delete set null,  -- null for period rollups
  type              text not null check (type in ('per_entry','weekly','monthly','quarterly','yearly','win')),
  lens              text,
  period_start      date,
  period_end        date,
  source_ids        uuid[] not null default '{}',     -- entries (weekly) or child insights (monthly/yearly)
  content_markdown  text,                              -- optional prose; UI mainly uses structured_payload
  structured_payload jsonb not null default '{}',      -- the contract in §3
  source_model      text,
  pushed            boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One rollup per (owner, type, period). Lets the job re-run idempotently.
-- NB: this is a PARTIAL unique index, so a bare supabase-js upsert (onConflict:
-- 'owner,type,period_start,period_end') CANNOT infer it as an ON CONFLICT
-- arbiter. The synthesis job therefore does an explicit select-then-update/insert
-- (see api/_lib/synthesize.ts upsertInsight) for idempotency; this index is the
-- database-level guard against ever landing two rows for the same period.
create unique index if not exists insights_period_key
  on public.insights (owner, type, period_start, period_end)
  where type in ('weekly','monthly','quarterly','yearly');

create index if not exists insights_type_period_idx
  on public.insights (owner, type, period_start desc);

drop trigger if exists insights_set_updated_at on public.insights;
create trigger insights_set_updated_at
  before update on public.insights
  for each row execute function public.set_updated_at();   -- reuse existing fn

alter table public.insights enable row level security;

drop policy if exists "insights are private to owner" on public.insights;
create policy "insights are private to owner"
  on public.insights for all
  using (auth.uid() = owner) with check (auth.uid() = owner);
-- NB: the service-role key used by the cron bypasses RLS; it must set `owner` explicitly on insert.
