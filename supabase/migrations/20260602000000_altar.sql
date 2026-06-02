-- Altar — a place of remembrance.
--
-- Light = ENCOUNTER, not transaction. A prayer/sense "lights" only when the user
-- testifies that God met them — however He moved. There is NO binary
-- answered/unanswered: the lit signal is purely the existence of an `encounters`
-- row. "Still carrying" = no encounter row (it stays unlit, by design, not as a
-- missed deadline).
--
-- Threads group a recurring prayer line + every return. A `prayer_thread` is one
-- distinct line; the prayer/sense touches that belong to it link via
-- `spiritual_items.thread_id`. The cairn's height = the number of touches.
--
-- Threading + embeddings are produced SERVER-SIDE only (backfill + daily cron):
-- the client never embeds or calls OpenAI. Ownership/RLS mirror entries,
-- spiritual_items, and scripture_refs exactly (owner column, default auth.uid()).

-- pgvector — standard on Supabase; embeddings are text-embedding-3-small (1536d).
create extension if not exists vector;

-- ── embeddings ───────────────────────────────────────────────────────────────
-- On entries (the open-thread similarity sweep searches these) and on threads
-- (the thread centroid is the query vector).
alter table public.entries add column if not exists embedding vector(1536);

-- spiritual_items gains an embedding (clustering input) + a thread link.
alter table public.spiritual_items add column if not exists embedding vector(1536);
alter table public.spiritual_items add column if not exists thread_id uuid;

-- ── prayer_threads ─────────────────────────────────────────────────────────-─
-- One row per distinct prayer/sense line. Drives the cairn (height = touches),
-- the Across-Time arc (planted_at → encounter), and the open-thread sweep.
create table if not exists public.prayer_threads (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,                       -- short label (Nano-generated; falls back to seed text)
  carries       text[] not null default '{}',        -- intercession targets parsed from thread text
  planted_at    timestamptz not null,                -- earliest touch's ENTRY date (source date, not import)
  last_touch_at timestamptz not null,                -- latest touch's entry date — bounds the sweep window
  seed_item_id  uuid references public.spiritual_items (id) on delete set null,
  embedding     vector(1536),                        -- centroid of member touches
  created_at    timestamptz not null default now()
);

-- The FK from spiritual_items → prayer_threads (added after the table exists so a
-- fresh DB and an incremental migration both work). on delete set null: deleting
-- a thread orphans its touches back to "unthreaded", never destroys the prayer.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'spiritual_items_thread_id_fkey'
  ) then
    alter table public.spiritual_items
      add constraint spiritual_items_thread_id_fkey
      foreign key (thread_id) references public.prayer_threads (id) on delete set null;
  end if;
end $$;

-- ── encounters ───────────────────────────────────────────────────────────────
-- The user's testimony of how God moved. One per thread, editable (the unique
-- constraint makes naming an upsert; clearing = delete → back to "still carrying").
-- The AI NEVER writes this row and never picks the movement word.
create table if not exists public.encounters (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id       uuid not null unique references public.prayer_threads (id) on delete cascade,
  movement        text not null check (movement in
                    ('answered','redirected','he_met_me','surrendered','he_changed_me')),
  named_at        timestamptz not null default now(),  -- the "He met you" date (evidence date, or now)
  source_entry_id uuid references public.entries (id) on delete set null,
  reflection_text text,
  created_at      timestamptz not null default now()
);

-- ── altar_candidates ─────────────────────────────────────────────────────────
-- One open, AI-surfaced piece of EVIDENCE per thread (replaced by the weekly
-- sweep, deleted when the user names an encounter or dismisses). Modeled on
-- echo_candidates. The fields are deliberately verdict-free: a quote + a gentle
-- question, never a movement label or a yes/no.
create table if not exists public.altar_candidates (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id       uuid not null unique references public.prayer_threads (id) on delete cascade,
  source_entry_id uuid references public.entries (id) on delete set null,
  entry_date      text not null,                      -- YYYY-MM-DD of the surfaced entry
  quote           text not null,                      -- verbatim slice of the entry
  char_start      int,
  char_end        int,
  one_line_reason text not null,                      -- "something here seems to stir"
  gentle_question text not null,                      -- "want to look?"
  created_at      timestamptz not null default now()
);

-- A dismissed (thread, entry) pair never resurfaces as a candidate again.
create table if not exists public.altar_candidate_dismissals (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id  uuid not null,
  entry_id   uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists altar_candidate_dismissals_dedup
  on public.altar_candidate_dismissals (owner, thread_id, entry_id);

-- ── indexes ──────────────────────────────────────────────────────────────────
create index if not exists prayer_threads_owner_touch
  on public.prayer_threads (owner, last_touch_at desc);
create index if not exists spiritual_items_thread_idx
  on public.spiritual_items (thread_id);

-- Cosine ANN indexes for the server-side similarity sweep. ivfflat is plenty for
-- a single-tenant journal; lists=100 is the standard small-corpus default.
create index if not exists entries_embedding_idx
  on public.entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists prayer_threads_embedding_idx
  on public.prayer_threads using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── vector search RPC (server-side only) ──────────────────────────────────────
-- PostgREST can't express the `<=>` cosine operator, so the open-thread sweep
-- calls this. security definer + an explicit owner filter keeps it owner-scoped
-- even though the service-role caller bypasses RLS.
create or replace function public.match_entries_for_thread(
  query_embedding vector(1536),
  owner_id uuid,
  since timestamptz,
  match_count int default 8
)
returns table (entry_id uuid, created_at timestamptz, distance float)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.created_at, (e.embedding <=> query_embedding) as distance
  from public.entries e
  where e.owner = owner_id
    and e.embedding is not null
    and e.created_at >= since
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- ── row-level security — owner-only, identical shape to entries/spiritual_items.
alter table public.prayer_threads enable row level security;
drop policy if exists "prayer_threads are private to owner" on public.prayer_threads;
create policy "prayer_threads are private to owner"
  on public.prayer_threads for all
  using (auth.uid() = owner) with check (auth.uid() = owner);

alter table public.encounters enable row level security;
drop policy if exists "encounters are private to owner" on public.encounters;
create policy "encounters are private to owner"
  on public.encounters for all
  using (auth.uid() = owner) with check (auth.uid() = owner);

alter table public.altar_candidates enable row level security;
drop policy if exists "altar_candidates are private to owner" on public.altar_candidates;
create policy "altar_candidates are private to owner"
  on public.altar_candidates for all
  using (auth.uid() = owner) with check (auth.uid() = owner);

alter table public.altar_candidate_dismissals enable row level security;
drop policy if exists "altar_candidate_dismissals are private to owner" on public.altar_candidate_dismissals;
create policy "altar_candidate_dismissals are private to owner"
  on public.altar_candidate_dismissals for all
  using (auth.uid() = owner) with check (auth.uid() = owner);
-- NB: the service-role key used by the backfill/cron bypasses RLS; it sets `owner` explicitly.
