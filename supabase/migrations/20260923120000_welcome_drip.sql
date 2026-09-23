-- Welcome drip enrollment — durable per-user ledger for the feature-discovery
-- series (docs/WELCOME_EMAILS.md). The daily cron and the one-shot backfill
-- are the only writers; the client never reads this table.
--
--   owner        auth user (cascades on account delete)
--   enrolled_at  UTC calendar day used as the day-offset anchor
--   source       signup (new profile) | backfill (existing accounts)
--   status       active until every enroll-map step is sent or skipped
--   steps        { "<key>": { "status": "sent"|"skipped", "at": iso, "reason"? } }
--
-- Day 13 `trial` is intentionally absent: it is not enrolled, not cron'd.

create table if not exists public.welcome_drip_enrollments (
  owner        uuid primary key references auth.users (id) on delete cascade,
  enrolled_at  date not null,
  source       text not null check (source in ('signup', 'backfill')),
  status       text not null default 'active' check (status in ('active', 'completed')),
  steps        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists welcome_drip_enrollments_active_idx
  on public.welcome_drip_enrollments (enrolled_at)
  where status = 'active';

drop trigger if exists welcome_drip_enrollments_set_updated_at on public.welcome_drip_enrollments;
create trigger welcome_drip_enrollments_set_updated_at
  before update on public.welcome_drip_enrollments
  for each row execute function public.set_updated_at();

alter table public.welcome_drip_enrollments enable row level security;

comment on table public.welcome_drip_enrollments is
  'Welcome series enrollment ledger. Service-role only; RLS on, no client policies.';
