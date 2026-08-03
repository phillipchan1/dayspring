-- marks — the passages a writer set apart while re-reading.
--
-- Remember reads four sources. Three of them already exist in the document:
-- markdown emphasis, blockquotes, and `/pray` blocks. This is the fourth, and
-- the only one that needed a table, because it's the only one that records WHEN
-- something was noticed.
--
-- That distinction is the whole reason this table exists. Bold in a 2019 entry
-- is dated 2019 whether it was typed then or added last week — so the derived
-- sources can show you what you set apart, but never that you went back years
-- later and something landed differently. `noticed_at` is that signal, and the
-- weather grid is drawn against it.
--
-- The RECORD OF TRUTH IS `quote`, NOT `char_start`. Offsets drift the moment an
-- entry is edited, so the anchor is re-found by searching for the text on load.
-- If the sentence is gone the mark is orphaned: still listed in Remember (it is
-- the writer's own words, verbatim) but no longer able to jump. Storing the text
-- is also what makes a mark exportable as plain markdown — no hostages.
--
-- Deliberately absent: colour, tag, category, note. A mark is one gesture with
-- no decision attached. The moment marking requires a choice, Remember is a
-- filing system.

create table if not exists public.marks (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  entry_id   uuid not null references public.entries (id) on delete cascade,
  quote      text not null,
  -- Best-effort re-anchor hint. Never trusted on its own.
  char_start int,
  noticed_at timestamptz not null default now()
);

-- Marking the same sentence twice is a no-op, not a duplicate. md5() because a
-- btree index can't take an unbounded text column.
create unique index if not exists marks_entry_quote_uq
  on public.marks (entry_id, md5(quote));

-- The surface's only query: this owner's marks, newest first.
create index if not exists marks_owner_noticed_idx
  on public.marks (owner, noticed_at desc);

-- Owner-only, same shape as entries and spiritual_items.
alter table public.marks enable row level security;

drop policy if exists "marks are private to owner" on public.marks;
create policy "marks are private to owner"
  on public.marks
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
