-- profiles — one row per user for account-level flags that aren't per-device.
-- First use: has_seen_welcome (the first-run Welcome flow). Per-device prefs stay
-- in localStorage (settingsStore); this is for state that should follow the
-- account across devices.

create table if not exists public.profiles (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users (id) on delete cascade unique,
  has_seen_welcome boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Keep updated_at fresh on every write (shared trigger fn from schema.sql).
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles are private to owner" on public.profiles;
create policy "profiles are private to owner"
  on public.profiles
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
