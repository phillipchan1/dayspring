-- echo_candidates — one current echo per user (replaced weekly by the cron job).
-- Ephemeral: when dismissed, the row is deleted. History lives only in echo_dismissals.

create table if not exists public.echo_candidates (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade unique,
  entry_id    uuid references public.entries (id) on delete cascade,
  text        text not null,
  entry_date  text not null,  -- YYYY-MM-DD (from the rollup quote)
  created_at  timestamptz not null default now()
);

alter table public.echo_candidates enable row level security;

drop policy if exists "echo_candidates are private to owner" on public.echo_candidates;
create policy "echo_candidates are private to owner"
  on public.echo_candidates
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- echo_dismissals — tracks which entries should never resurface.
-- Small, append-only. No row limit — if a user dismisses 1000 entries we
-- accept that; the pool is bounded by rollup history anyway.

create table if not exists public.echo_dismissals (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  entry_id   uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists echo_dismissals_owner_entry_idx
  on public.echo_dismissals (owner, entry_id);

alter table public.echo_dismissals enable row level security;

drop policy if exists "echo_dismissals are private to owner" on public.echo_dismissals;
create policy "echo_dismissals are private to owner"
  on public.echo_dismissals
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
