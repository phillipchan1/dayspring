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
alter table public.entries add column if not exists embedding real[];

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

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
