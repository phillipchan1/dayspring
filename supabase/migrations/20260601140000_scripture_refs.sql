-- scripture_refs — one row per scripture reference captured from an entry.
--
-- The Scripture surface ("Where your heart has been leaning") reads this table:
-- the canon map is lit by which passages an entry returns to, and when. A ref
-- only points back to its entry by (entry_id, char range) — the user's prose is
-- never rewritten.
--
-- Ownership/RLS mirror `entries`: the column is `owner` (default auth.uid()),
-- not `user_id`. `entry_created_at` is DENORMALIZED from entries.created_at so
-- the season scrubber and every time query read one indexed column — and for
-- imported entries it is the ORIGINAL entry date, never the import date.

create table if not exists public.scripture_refs (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id         uuid not null references public.entries (id) on delete cascade,
  book_osis        text not null,            -- 'Ps','Rom','John','1Cor'
  book_name        text not null,            -- 'Psalms','Romans'
  book_order       int  not null,            -- 1..66 canonical; drives sort + OT/NT split
  chapter          int  not null,
  verse_start      int,                      -- null for chapter-only refs
  verse_end        int,
  osis_ref         text not null,            -- 'Rom.8.28' or 'Rom.8.28-Rom.8.30'
  entry_created_at timestamptz not null,     -- denormalized from entries.created_at (source date)
  source           text not null check (source in ('parsed','inline','command','manual')),
  confidence       real not null default 1,  -- 1.0 for command/manual; parser conf otherwise
  status           text not null default 'confirmed' check (status in ('confirmed','suggested')),
  char_start       int,                      -- offset in body_markdown (nullable)
  char_end         int,
  created_at       timestamptz not null default now()
);

-- One row per (entry, osis_ref) → upserts are idempotent (backfill re-runs, live
-- re-parse on every keystroke). A bare supabase-js upsert can infer this arbiter.
create unique index if not exists scripture_refs_dedup
  on public.scripture_refs (entry_id, osis_ref);

-- Season scrubber + all time-window queries read entry_created_at.
create index if not exists scripture_refs_owner_season
  on public.scripture_refs (owner, entry_created_at);

-- Canon map heat: per (owner, book, chapter).
create index if not exists scripture_refs_book
  on public.scripture_refs (owner, book_order, chapter);

-- Keep the denormalized date correct if an entry's date is ever edited.
create or replace function public.sync_scripture_ref_dates()
returns trigger language plpgsql as $$
begin
  if new.created_at is distinct from old.created_at then
    update public.scripture_refs
       set entry_created_at = new.created_at
     where entry_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_sync_scripture_dates on public.entries;
create trigger entries_sync_scripture_dates
  after update of created_at on public.entries
  for each row execute function public.sync_scripture_ref_dates();

-- ── Row-level security — owner-only, identical shape to entries/spiritual_items.
alter table public.scripture_refs enable row level security;

drop policy if exists "scripture_refs are private to owner" on public.scripture_refs;
create policy "scripture_refs are private to owner"
  on public.scripture_refs
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
-- NB: the service-role key used by the backfill bypasses RLS; it sets `owner` explicitly.
