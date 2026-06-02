-- Altar v2 — cairns are SUBJECTS you bring to God (a person, place, or theme),
-- not text-clusters. A prayer can touch up to ~3 subjects (many-to-many). A
-- cairn's height in a view = how many prayers touch it within the season window,
-- so the same subject (e.g. Esther) rises across all-time and settles in a
-- season — density that cascades with the zoom.
--
-- We reuse prayer_threads AS the subject/cairn row (so encounters.thread_id and
-- altar_candidates.thread_id keep working unchanged) and add a join table for the
-- many-to-many membership (the old 1:1 spiritual_items.thread_id is retired).

alter table public.prayer_threads add column if not exists kind text; -- 'person' | 'place' | 'theme'

-- A prayer ↔ subject membership (many-to-many).
create table if not exists public.item_subjects (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    uuid not null references public.spiritual_items (id) on delete cascade,
  subject_id uuid not null references public.prayer_threads (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists item_subjects_dedup on public.item_subjects (item_id, subject_id);
create index if not exists item_subjects_subject on public.item_subjects (subject_id);
create index if not exists item_subjects_item on public.item_subjects (item_id);

alter table public.item_subjects enable row level security;
drop policy if exists "item_subjects are private to owner" on public.item_subjects;
create policy "item_subjects are private to owner"
  on public.item_subjects for all
  using (auth.uid() = owner) with check (auth.uid() = owner);

-- ── the Field, in one aggregate query ─────────────────────────────────────────
-- Per subject: how many prayers touch it within [from_ts, to_ts) (the cairn's
-- height in this window), the all-time total, and whether it's lit / has evidence.
-- Dates use spiritual_items.created_at (set to the source ENTRY date at harvest).
-- Null bounds = all time. Only subjects alive in the window are returned.
create or replace function public.altar_field(owner_id uuid, from_ts timestamptz, to_ts timestamptz)
returns table (
  subject_id uuid,
  title text,
  kind text,
  carries text[],
  planted_at timestamptz,
  last_touch_at timestamptz,
  window_count bigint,
  total_count bigint,
  lit boolean,
  has_candidate boolean
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.title, s.kind, s.carries, s.planted_at, s.last_touch_at,
    count(*) filter (
      where (from_ts is null or i.created_at >= from_ts)
        and (to_ts is null or i.created_at < to_ts)
    ) as window_count,
    count(*) as total_count,
    exists (select 1 from public.encounters e where e.thread_id = s.id) as lit,
    exists (select 1 from public.altar_candidates c where c.thread_id = s.id) as has_candidate
  from public.prayer_threads s
  join public.item_subjects ms on ms.subject_id = s.id
  join public.spiritual_items i on i.id = ms.item_id
  where s.owner = owner_id
  group by s.id
  having count(*) filter (
    where (from_ts is null or i.created_at >= from_ts)
      and (to_ts is null or i.created_at < to_ts)
  ) > 0
$$;
