-- The gather engine — one reader per entry, driven by "the words changed and the
-- writer has stopped", not by the clock. See docs/GATHER.md.
--
-- ── What it replaces ─────────────────────────────────────────────────────────
--
-- Three scanners each kept their own "have I read this entry?" mark
-- (prayer_scanned_at, concordance_scanned_at, embedding IS NULL) and each set it
-- once, forever. So:
--
--   · an entry still being written when the 08:00 UTC cron ran was read as it
--     stood at that minute, and the rest of it was never read;
--   · an entry edited later was never read again — a prayer added the next day
--     never reached the Altar, and a harvested line the writer deleted stayed;
--   · new writing waited up to a day, behind a per-owner daily cap.
--
-- ── The model ────────────────────────────────────────────────────────────────
--
--   body_hash       md5 of the body, maintained by Postgres (generated).
--   gathered_hash   the body_hash the engine last gathered. Set by gather_stamp.
--
-- An entry is PENDING when the two differ, and READY when it has also sat
-- untouched for the settle window (updated_at only moves on a real edit — see
-- 20260823120000). The engine stamps the hash of the body it actually READ, so
-- an edit that lands mid-gather leaves the entry pending rather than lost.
--
--   gathered_words_hash  md5 of the writer's own words at the last gather. When a
--                        later edit only touched a Scripture fence, this still
--                        matches and the model is not called again.
--   gather_attempts      consecutive failed gathers of THIS entry. At the cap the
--                        engine stamps it anyway, so one unreadable page cannot
--                        hold the queue (or be billed) forever.
--
-- None of the three settable columns is in ENTRY_COLUMNS, so by the rule in
-- 20260823120000 writing them never moves updated_at.

-- Adding a STORED generated column rewrites the table, and a rewrite rebuilds
-- every index on it — including entries_embedding_idx (ivfflat, lists=100),
-- whose build wants ~62 MB against a default maintenance_work_mem of 32 MB. The
-- first attempt at this migration failed on exactly that ("memory required is
-- 62 MB, maintenance_work_mem is 32 MB") before anything was written. Raise it
-- for this session; it is put back at the end of the file.
set maintenance_work_mem = '256MB';

alter table public.entries
  add column if not exists body_hash text generated always as (md5(body_markdown)) stored;
alter table public.entries add column if not exists gathered_hash text;
alter table public.entries add column if not exists gathered_words_hash text;
alter table public.entries add column if not exists gather_attempts smallint not null default 0;

-- Cut-over: an entry all three old scanners have already read is up to date as
-- far as anyone can tell — mark it gathered so switching the engine on does not
-- re-read (and re-bill) the whole archive. Everything else stays pending and is
-- picked up by the engine, which honours the old marks on a first gather and
-- only runs the steps an entry is actually missing.
--
-- NOTE: this touches every such row once, and `entries` is in the realtime
-- publication, so each connected device receives one (no-op) change event per
-- entry — the same event a harvest stamp has always produced. Run it at a quiet
-- hour for a large archive.
update public.entries
   set gathered_hash = body_hash
 where gathered_hash is null
   and prayer_scanned_at is not null
   and concordance_scanned_at is not null
   and embedding is not null;

-- The queue. Shrinks to nothing once an archive is gathered.
create index if not exists entries_gather_pending
  on public.entries (owner, updated_at)
  where gathered_hash is distinct from body_hash;

-- ── job kind ─────────────────────────────────────────────────────────────────

alter table public.processing_jobs drop constraint if exists processing_jobs_kind_check;
alter table public.processing_jobs add constraint processing_jobs_kind_check
  check (kind in ('reflections','scripture','altar_harvest','altar_embed','altar_thread',
                  'concordance','gather'));

-- ── queue readers ────────────────────────────────────────────────────────────
-- Column-to-column comparison is not expressible through PostgREST filters, so
-- the three reads the engine needs are functions.

-- Owners with at least one entry ready to gather, oldest wait first.
create or replace function public.gather_pending_owners(p_settle interval, p_limit integer)
returns table (owner uuid, pending bigint)
language sql
stable
set search_path = public
as $$
  select e.owner, count(*) as pending
    from entries e
   where e.gathered_hash is distinct from e.body_hash
     and e.updated_at <= now() - p_settle
   group by e.owner
   order by min(e.updated_at)
   limit p_limit;
$$;

create or replace function public.gather_pending_count(p_owner uuid, p_settle interval)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)
    from entries e
   where e.owner = p_owner
     and e.gathered_hash is distinct from e.body_hash
     and e.updated_at <= now() - p_settle;
$$;

-- One tick's worth of an owner's ready entries, most recent first (so the
-- surfaces a reader opens — the latest week, the newest cairns — fill first).
create or replace function public.gather_pending_entries(
  p_owner uuid, p_settle interval, p_limit integer
)
returns table (
  id                  uuid,
  created_at          timestamptz,
  body_markdown       text,
  body_hash           text,
  gathered_hash       text,
  gathered_words_hash text,
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
         e.gathered_hash, e.gathered_words_hash, e.gather_attempts,
         e.prayer_scanned_at is not null,
         e.concordance_scanned_at is not null,
         e.embedding is not null
    from entries e
   where e.owner = p_owner
     and e.gathered_hash is distinct from e.body_hash
     and e.updated_at <= now() - p_settle
   order by e.created_at desc, e.id
   limit p_limit;
$$;

-- ── the stamp ────────────────────────────────────────────────────────────────
-- p_rows: [{ "id": uuid, "body_hash": text, "words_hash": text|null, "ok": bool }]
--
--   ok      → the entry was gathered: record the hash of the body that was READ
--             (not the current one — an edit since then must leave it pending).
--   not ok  → count the attempt. At p_max_attempts, stamp it anyway and start the
--             count over; words_hash is left alone so the next real edit re-reads
--             the whole entry rather than trusting a gather that never finished.
--
-- Returns how many entries were given up on, for the job summary.
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
         gather_attempts     = 0
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(id uuid, body_hash text, words_hash text, ok boolean)
   where e.id = r.id and e.owner = p_owner and r.ok;

  with failed as (
    update entries e
       set gathered_hash   = case when e.gather_attempts + 1 >= p_max_attempts
                                  then r.body_hash else e.gathered_hash end,
           gather_attempts = case when e.gather_attempts + 1 >= p_max_attempts
                                  then 0 else e.gather_attempts + 1 end
      from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as r(id uuid, body_hash text, words_hash text, ok boolean)
     where e.id = r.id and e.owner = p_owner and not r.ok
    returning (e.gather_attempts = 0) as gave_up
  )
  select count(*) filter (where gave_up) into v_given_up from failed;

  return coalesce(v_given_up, 0);
end;
$$;

-- Service role only: each takes an owner (or returns owners) as data.
revoke all on function public.gather_pending_owners(interval, integer)        from public, anon, authenticated;
revoke all on function public.gather_pending_count(uuid, interval)             from public, anon, authenticated;
revoke all on function public.gather_pending_entries(uuid, interval, integer)  from public, anon, authenticated;
revoke all on function public.gather_stamp(uuid, jsonb, integer)               from public, anon, authenticated;
grant execute on function public.gather_pending_owners(interval, integer)       to service_role;
grant execute on function public.gather_pending_count(uuid, interval)           to service_role;
grant execute on function public.gather_pending_entries(uuid, interval, integer) to service_role;
grant execute on function public.gather_stamp(uuid, jsonb, integer)             to service_role;

reset maintenance_work_mem;
