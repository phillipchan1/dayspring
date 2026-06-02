-- reminders — user's own words returned to them on a chosen date.
-- No completion state. No task UI. The row simply fires once.

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  entry_id   uuid references public.entries (id) on delete set null,
  content    text not null,
  remind_at  timestamptz not null,
  fired      boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reminders_owner_remind_at_idx
  on public.reminders (owner, remind_at)
  where fired = false;

alter table public.reminders enable row level security;

drop policy if exists "reminders are private to owner" on public.reminders;
create policy "reminders are private to owner"
  on public.reminders
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
