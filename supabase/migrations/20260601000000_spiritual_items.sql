-- spiritual_items — prayers, sense/impressions, and saved scripture passages.
-- Linked to entries via entry_id (nullable; slash commands fire from the editor so
-- there's usually an entry in context, but not required).

create table if not exists public.spiritual_items (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  entry_id    uuid references public.entries (id) on delete set null,
  type        text not null check (type in ('prayer', 'sense', 'scripture')),
  content     text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists spiritual_items_owner_type_idx
  on public.spiritual_items (owner, type, created_at desc);

-- Owner-only read/write, same pattern as entries.
alter table public.spiritual_items enable row level security;

drop policy if exists "spiritual_items are private to owner" on public.spiritual_items;
create policy "spiritual_items are private to owner"
  on public.spiritual_items
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
