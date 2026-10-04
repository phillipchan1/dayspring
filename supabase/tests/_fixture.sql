-- Minimal stand-in for the Supabase schema so the migration can be exercised.
-- `auth.uid()` and pgvector aren't available here, so owner defaults to a fixed
-- uuid and embedding is a plain array — neither affects what we're testing.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;

create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default '00000000-0000-0000-0000-000000000001' references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  body_markdown text not null default '',
  title         text,
  mood          text,
  tags          text[] not null default '{}',
  word_count    integer not null default 0,
  source        text not null default 'native' check (source in ('native', 'day_one', 'diarly', 'other')),
  external_id   text
);
-- Server-derived columns, added by later migrations. They belong here because
-- the whole point of the updated_at trigger is that writing one of these is not
-- a user edit — a fixture without them can't tell whether that holds.
alter table public.entries add column if not exists embedding real[];              -- 20260602000000_altar
alter table public.entries add column if not exists prayer_scanned_at timestamptz; -- 20260602020000_altar_harvest
alter table public.entries add column if not exists superseded boolean not null default false; -- 20260604130000_threads_v2
alter table public.entries add column if not exists entry_lens text;               -- 20260604130000_threads_v2
alter table public.entries add column if not exists entry_domain text;             -- 20260604130000_threads_v2
alter table public.entries add column if not exists concordance_scanned_at timestamptz; -- 20260611120000_concordance

-- Stand-ins for the two other tables the gather migrations touch
-- (20260930120000_reconcile_scanned_items, 20260930130000_gather_engine), reduced
-- to the columns those functions read and write.
create table if not exists public.spiritual_items (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null references auth.users (id) on delete cascade,
  entry_id          uuid, -- no FK here: multi_device_sync.test.sql truncates entries on its own
  type              text not null,
  content           text not null,
  created_at        timestamptz not null default now(),
  source            text not null default 'command',
  subject_tagged_at timestamptz
);
create table if not exists public.processing_jobs (
  id   uuid primary key default gen_random_uuid(),
  kind text not null,
  constraint processing_jobs_kind_check check (kind in ('reflections'))
);

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

drop publication if exists supabase_realtime;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entries;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I', r);
    end if;
  end loop;
end $$;

-- auth.uid() stand-in, so a migration's RLS policy can be created. The fixture
-- runs as a superuser, so policies are never enforced here — only defined.
create or replace function auth.uid() returns uuid
language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
