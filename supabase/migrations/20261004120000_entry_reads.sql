-- The entry read, stored — what the writer felt, desired, lived, learned and
-- saw change on each page, read by the gather engine and kept. D-035,
-- docs/GATHER.md § The read.
--
-- ── Why ──────────────────────────────────────────────────────────────────────
--
-- The read (api/_lib/keepingRead.ts) existed only as a private playground call
-- that stored nothing, so no surface could show emotion or learning over time.
-- This table is its output; the gather engine fills it, behind GATHER_READ.
--
-- ── The model ────────────────────────────────────────────────────────────────
--
--   entry_reads.words_hash   md5 of the writer's own words the read was made from.
--   entries.read_words_hash  the same hash, on the entry, so the queue can see an
--                            entry whose read is missing or stale without a join.
--
-- With GATHER_READ on, an entry is pending when its body changed (as before) OR
-- its read is missing/stale: read_words_hash is null, or differs from
-- gathered_words_hash. The second clause is the backfill — an archive the engine
-- already gathered is read once, and ONLY read: harvest, concordance and the
-- embedding key off gathered_hash, which already matches, so none is re-billed.
--
-- read_words_hash is a derived column: not in ENTRY_COLUMNS, so by the rule in
-- 20260823120000 writing it never moves updated_at.

set maintenance_work_mem = '256MB';

alter table public.entries add column if not exists read_words_hash text;

-- ── the stored read ─────────────────────────────────────────────────────────
--
-- One row per entry, replaced whenever the writer's words change. The aggregate
-- columns are what Ascent reads (light, one query per session); `movements`
-- holds the whole read for later surfaces and for correction.
--
-- No entry date here on purpose: the date belongs to the entry, and a writer can
-- move it. Surfaces join on entry_id.
create table if not exists public.entry_reads (
  entry_id    uuid primary key references public.entries (id) on delete cascade,
  owner       uuid not null references auth.users (id) on delete cascade,
  version     text not null,
  words_hash  text not null,
  truncated   boolean not null default false,
  -- Whole-page sentiment, confidence-weighted over movements (aggregateSentiment).
  present     boolean not null default false,
  valence     real not null default 0 check (valence between -1 and 1),
  activation  real not null default 0 check (activation between 0 and 1),
  confidence  real not null default 0 check (confidence between 0 and 1),
  -- [{ emotion, intensity, quote }] — every quote is verbatim from the entry.
  emotions    jsonb not null default '[]'::jsonb,
  -- [{ kind, quote, confidence, movement }] — desire, story, learning, change,
  -- prayer, scripture. Flat, so a surface can ask for "learning" without
  -- unpacking every movement.
  ingredients jsonb not null default '[]'::jsonb,
  -- The full MovementReading[] from the read.
  movements   jsonb not null default '[]'::jsonb,
  read_at     timestamptz not null default now()
);

create index if not exists entry_reads_owner on public.entry_reads (owner);

alter table public.entry_reads enable row level security;

-- The writer reads their own. Writes are the engine's (service role) only.
drop policy if exists entry_reads_select_own on public.entry_reads;
create policy entry_reads_select_own on public.entry_reads
  for select using (owner = auth.uid());

-- The read queue. Holds every never-read entry until the backfill drains it.
create index if not exists entries_read_pending
  on public.entries (owner, updated_at)
  where read_words_hash is null or read_words_hash <> gathered_words_hash;

-- ── queue readers, now read-aware ───────────────────────────────────────────
-- Same functions, one new argument. p_read defaults to false, so a caller that
-- does not pass it (code deployed before GATHER_READ, or with it off) gets
-- exactly the old queue. Dropped and recreated because the argument list (and,
-- for gather_pending_entries, the returned columns) change.

drop function if exists public.gather_pending_owners(interval, integer);
drop function if exists public.gather_pending_count(uuid, interval);
drop function if exists public.gather_pending_entries(uuid, interval, integer);

-- Two branches, each matching one partial index, rather than one OR the planner
-- would answer with a scan of every entry every minute. UNION (not ALL) so an
-- entry pending for both reasons counts once.
create or replace function public.gather_pending_owners(
  p_settle interval, p_limit integer, p_read boolean default false
)
returns table (owner uuid, pending bigint)
language sql
stable
set search_path = public
as $$
  select q.owner, count(*) as pending
    from (
      select e.id, e.owner, e.updated_at
        from entries e
       where e.gathered_hash is distinct from e.body_hash
         and e.updated_at <= now() - p_settle
      union
      select e.id, e.owner, e.updated_at
        from entries e
       where p_read
         and (e.read_words_hash is null or e.read_words_hash <> e.gathered_words_hash)
         and e.updated_at <= now() - p_settle
    ) q
   group by q.owner
   order by min(q.updated_at)
   limit p_limit;
$$;

create or replace function public.gather_pending_count(
  p_owner uuid, p_settle interval, p_read boolean default false
)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)
    from (
      select e.id
        from entries e
       where e.owner = p_owner
         and e.gathered_hash is distinct from e.body_hash
         and e.updated_at <= now() - p_settle
      union
      select e.id
        from entries e
       where p_read
         and e.owner = p_owner
         and (e.read_words_hash is null or e.read_words_hash <> e.gathered_words_hash)
         and e.updated_at <= now() - p_settle
    ) q;
$$;

create or replace function public.gather_pending_entries(
  p_owner uuid, p_settle interval, p_limit integer, p_read boolean default false
)
returns table (
  id                  uuid,
  created_at          timestamptz,
  body_markdown       text,
  body_hash           text,
  gathered_hash       text,
  gathered_words_hash text,
  read_words_hash     text,
  gather_attempts     smallint,
  prayer_scanned      boolean,
  concordance_scanned boolean,
  embedded            boolean
)
language sql
stable
set search_path = public
as $$
  select e.id, e.created_at, e.body_markdown, e.body_hash,
         e.gathered_hash, e.gathered_words_hash, e.read_words_hash, e.gather_attempts,
         e.prayer_scanned_at is not null,
         e.concordance_scanned_at is not null,
         e.embedding is not null
    from entries e
   where e.id in (
           select p.id
             from entries p
            where p.owner = p_owner
              and p.gathered_hash is distinct from p.body_hash
              and p.updated_at <= now() - p_settle
           union
           select p.id
             from entries p
            where p_read
              and p.owner = p_owner
              and (p.read_words_hash is null or p.read_words_hash <> p.gathered_words_hash)
              and p.updated_at <= now() - p_settle
         )
   order by e.created_at desc, e.id
   limit p_limit;
$$;

-- ── the stamp, now read-aware ───────────────────────────────────────────────
-- p_rows: [{ "id", "body_hash", "words_hash", "read_hash": text|null, "ok" }]
--
-- read_hash is the words hash the read was made from (null when no read was
-- asked for — the flag is off, or the stored read is already current).
--
--   ok      → as before, plus read_words_hash := read_hash when one was read.
--   not ok  → as before. At p_max_attempts, also mark the read as given up
--             (read_words_hash := gathered_words_hash, or read_hash when there is
--             none), so a page the model cannot read leaves the read queue too
--             instead of being retried every minute. A later real edit re-reads.
--
-- A caller that sends no read_hash (GATHER_READ off) leaves read_words_hash alone.
create or replace function public.gather_stamp(p_owner uuid, p_rows jsonb, p_max_attempts integer)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_given_up integer;
begin
  update entries e
     set gathered_hash       = r.body_hash,
         gathered_words_hash = r.words_hash,
         read_words_hash     = coalesce(r.read_hash, e.read_words_hash),
         gather_attempts     = 0
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(id uuid, body_hash text, words_hash text, read_hash text, ok boolean)
   where e.id = r.id and e.owner = p_owner and r.ok;

  with failed as (
    update entries e
       set gathered_hash   = case when e.gather_attempts + 1 >= p_max_attempts
                                  then r.body_hash else e.gathered_hash end,
           read_words_hash = case when e.gather_attempts + 1 >= p_max_attempts
                                   and r.read_hash is not null
                                  then coalesce(e.gathered_words_hash, r.read_hash)
                                  else e.read_words_hash end,
           gather_attempts = case when e.gather_attempts + 1 >= p_max_attempts
                                  then 0 else e.gather_attempts + 1 end
      from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as r(id uuid, body_hash text, words_hash text, read_hash text, ok boolean)
     where e.id = r.id and e.owner = p_owner and not r.ok
    returning (e.gather_attempts = 0) as gave_up
  )
  select count(*) filter (where gave_up) into v_given_up from failed;

  return coalesce(v_given_up, 0);
end;
$$;

revoke all on function public.gather_pending_owners(interval, integer, boolean)        from public, anon, authenticated;
revoke all on function public.gather_pending_count(uuid, interval, boolean)             from public, anon, authenticated;
revoke all on function public.gather_pending_entries(uuid, interval, integer, boolean)  from public, anon, authenticated;
revoke all on function public.gather_stamp(uuid, jsonb, integer)                        from public, anon, authenticated;
grant execute on function public.gather_pending_owners(interval, integer, boolean)       to service_role;
grant execute on function public.gather_pending_count(uuid, interval, boolean)           to service_role;
grant execute on function public.gather_pending_entries(uuid, interval, integer, boolean) to service_role;
grant execute on function public.gather_stamp(uuid, jsonb, integer)                     to service_role;

reset maintenance_work_mem;
