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
  source        text not null default 'native' check (source in ('native', 'day_one', 'other')),
  external_id   text
);

-- Dedup target for idempotent imports (§7): (source, external_id) is unique
-- when external_id is present. Native entries have null external_id, so they
-- are never deduped against each other.
create unique index if not exists entries_source_external_id_key
  on public.entries (source, external_id)
  where external_id is not null;

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
