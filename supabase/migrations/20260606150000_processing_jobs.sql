-- processing_jobs — one per-owner, per-kind background job for building a new
-- account's intelligence surfaces (reflections rollups + altar) from imported
-- history. The daily synthesize cron is the steady-state heartbeat for caught-up
-- users; these jobs are the one-time catch-up for an archive. Drained by
-- /api/cron/process-tick in bounded chunks so a decade-import never times out.
-- See docs/PROCESSING_AND_ONBOARDING.md.

create table if not exists public.processing_jobs (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in
               ('reflections','scripture','altar_harvest','altar_embed','altar_thread')),
  status     text not null default 'queued'
               check (status in ('queued','running','done','failed')),
  cursor     jsonb not null default '{}'::jsonb,  -- resume point (stage/index/range)
  total      integer not null default 0,          -- planned unit count, for progress %
  completed  integer not null default 0,
  attempts   integer not null default 0,
  error      text,
  locked_at  timestamptz,                          -- heartbeat for stuck-job reclaim
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active job per (owner, kind): prevents dup work + threading races. The
-- engine inserts with on-conflict-do-nothing against this index.
create unique index if not exists processing_jobs_one_active
  on public.processing_jobs (owner, kind) where status in ('queued','running');

-- Keep updated_at fresh on every write (shared trigger fn from schema.sql).
drop trigger if exists processing_jobs_set_updated_at on public.processing_jobs;
create trigger processing_jobs_set_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();

alter table public.processing_jobs enable row level security;

-- Owner reads (for the live progress UI); the service role writes.
drop policy if exists "jobs readable by owner" on public.processing_jobs;
create policy "jobs readable by owner"
  on public.processing_jobs
  for select
  using (auth.uid() = owner);

-- Live progress on the surfaces (SurfaceLoader subscribes per owner).
alter publication supabase_realtime add table public.processing_jobs;

-- Atomic claim for the drain worker: grab up to k queued/stale jobs, mark them
-- running, bump attempts. FOR UPDATE SKIP LOCKED guarantees two overlapping ticks
-- never grab the same job. Called by the service role only.
create or replace function public.claim_processing_jobs(k integer)
returns setof public.processing_jobs
language sql
as $$
  update public.processing_jobs
     set status = 'running', locked_at = now(), attempts = attempts + 1
   where id in (
     select id from public.processing_jobs
      where status in ('queued','running')
        and (locked_at is null or locked_at < now() - interval '5 minutes')
      order by created_at
      for update skip locked
      limit k
   )
  returning *;
$$;
