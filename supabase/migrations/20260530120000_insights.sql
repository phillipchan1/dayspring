-- Migration: insights table (grounded monthly/weekly rollups — "Reflections").
-- Idempotent; safe to re-run. Mirrors the insights block in schema.sql (§5).

create table if not exists public.insights (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id          uuid references public.entries (id) on delete set null,
  type              text not null check (type in ('per_entry','weekly','monthly','yearly','win')),
  lens              text,
  period_start      date,
  period_end        date,
  source_ids        uuid[] not null default '{}',
  content_markdown  text,
  structured_payload jsonb not null default '{}',
  source_model      text,
  pushed            boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists insights_period_key
  on public.insights (owner, type, period_start, period_end)
  where type in ('weekly','monthly','yearly');

create index if not exists insights_type_period_idx
  on public.insights (owner, type, period_start desc);

drop trigger if exists insights_set_updated_at on public.insights;
create trigger insights_set_updated_at
  before update on public.insights
  for each row execute function public.set_updated_at();

alter table public.insights enable row level security;

drop policy if exists "insights are private to owner" on public.insights;
create policy "insights are private to owner"
  on public.insights for all
  using (auth.uid() = owner) with check (auth.uid() = owner);
