-- kept_subjects — the things the writer said they carry.
--
-- The journal already notices names on its own: the Concordance records every
-- spelling someone uses, and the wall can light any of them. That is offered.
-- This table is the other half — the writer answering, "yes, that one."
--
-- RECALL Act one lays out four mechanisms and the two live ones pull against
-- each other: nothing is kept and your own words are the index (free, but fails
-- the moment you arrive not knowing the word), or you name what you carry
-- (total control, total setup, one gesture from the tag manager SURFACES.md
-- forbids). This is 1.2, which RECALL already calls the strongest: it offers,
-- and you keep. Recognition beats recall, there is nothing to set up, and every
-- kept subject traces to something actually written.
--
-- WHAT IS DELIBERATELY ABSENT, and must stay absent: colour, rename, merge,
-- nesting, archive, parent, order-by-hand. Keeping is ONE gesture with no
-- decision attached. The moment it grows management affordances this is a
-- to-do list about someone's prayer life.
--
-- ORDERING IS `kept_at`, NEVER A COUNT. Riverside above Mom at 31 pages to 14
-- would be the app ranking what a person carries, and a ranking of the people
-- in someone's life is a verdict rendered in a sort (Principle 1).
--
-- DROPPING IS SAFE, and that is what makes keeping cheap enough to do. The row
-- goes; the journal still notices the name, nothing the writer wrote changes,
-- and it is one click from kept again.

create table if not exists public.kept_subjects (
  id       uuid primary key default gen_random_uuid(),
  -- Defaulted like the Concordance's, so the client never names an owner and
  -- can never name the wrong one; RLS checks it either way.
  owner    uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- The subject's identity, keyed by NAME (`c:esther`) or by a typed word
  -- (`word:the move`) — never by a concordance row id. The Concordance is
  -- derived and rebuilds from its event log, reissuing ids every time; a kept
  -- subject has to survive a rebuild it knows nothing about.
  subject_key text not null,

  -- What to print. Stored rather than looked up so a kept subject still reads
  -- correctly if the Concordance drops the row it came from.
  label text not null,

  -- The spellings that counted as a hit when this was kept. A snapshot, not the
  -- authority: readers union these with whatever the Concordance knows for the
  -- same name today, so a nickname learned later still lights, while a rebuild
  -- that loses the row can never stop the subject matching.
  terms text[] not null default '{}',

  kept_at timestamptz not null default now()
);

-- Keeping the same subject twice is a no-op, not a duplicate.
create unique index if not exists kept_subjects_owner_key_uq
  on public.kept_subjects (owner, subject_key);

-- The surface's only query: this owner's kept subjects, in the order kept.
create index if not exists kept_subjects_owner_kept_idx
  on public.kept_subjects (owner, kept_at);

-- Owner-only, same shape as entries, marks and spiritual_items.
alter table public.kept_subjects enable row level security;

drop policy if exists "kept subjects are private to owner" on public.kept_subjects;
create policy "kept subjects are private to owner"
  on public.kept_subjects
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
