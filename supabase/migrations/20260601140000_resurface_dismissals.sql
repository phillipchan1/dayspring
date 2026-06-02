-- resurface_dismissals — soft "not now" for echo, prayer, reminder, and sense resurfacing.

create table if not exists public.resurface_dismissals (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('echo', 'open_prayer', 'due_reminder', 'anniversary_sense')),
  source_id   text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists resurface_dismissals_owner_type_id_idx
  on public.resurface_dismissals (owner, source_type, source_id);

alter table public.resurface_dismissals enable row level security;

drop policy if exists "resurface_dismissals are private to owner" on public.resurface_dismissals;
create policy "resurface_dismissals are private to owner"
  on public.resurface_dismissals
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
