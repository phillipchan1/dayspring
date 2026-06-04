-- Threads & Ropes — reflective thread clusters derived offline from entry embeddings.
--
-- vector extension and entries.embedding are already enabled (altar migration).
-- This migration adds only the threads table where derive-threads.ts writes results.
--
-- Idempotent: safe to re-apply.

-- ── threads ──────────────────────────────────────────────────────────────────
-- One row per reflective thread (cluster of entries sharing a recurring theme).
-- Written by scripts/derive-threads.ts; read by src/features/threads/data/index.ts.

create table if not exists public.threads (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  label             text not null,
  lenses            text[] not null default '{}',
  member_entry_ids  uuid[] not null default '{}',
  weight            int not null default 0,
  breadth           int not null default 0,
  span_start        timestamptz,
  span_end          timestamptz,
  sim_threshold     real,
  one_line_why      text,
  created_at        timestamptz not null default now()
);

create index if not exists threads_owner_span
  on public.threads (owner, span_end desc);

alter table public.threads enable row level security;
drop policy if exists "threads are private to owner" on public.threads;
create policy "threads are private to owner"
  on public.threads for all to authenticated
  using (auth.uid() = owner) with check (auth.uid() = owner);
