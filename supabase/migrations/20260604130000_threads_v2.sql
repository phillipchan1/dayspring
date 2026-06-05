-- Threads & Ropes v2 — entry-level derivation, ropes, thread_members.
-- Purely additive — no existing data is touched.

-- ── entries: dedupe marker + lens assignment cache ────────────────────────────
alter table public.entries
  add column if not exists superseded boolean not null default false,
  add column if not exists entry_lens  text,    -- interior lens assigned by Nano
  add column if not exists entry_domain text;   -- domain assigned by Nano

create index if not exists entries_live_idx
  on public.entries (owner, created_at desc) where superseded = false;
create index if not exists entries_lens_idx
  on public.entries (owner, entry_lens) where entry_lens is not null;
create index if not exists entries_domain_idx
  on public.entries (owner, entry_domain) where entry_domain is not null;

-- ── ropes (must exist before threads FK) ─────────────────────────────────────
create table if not exists public.ropes (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  label      text not null,
  label_user text,
  domain     text,
  span_start timestamptz,
  span_end   timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ropes enable row level security;
drop policy if exists "ropes are private to owner" on public.ropes;
create policy "ropes are private to owner"
  on public.ropes for all to authenticated
  using (auth.uid() = owner) with check (auth.uid() = owner);

-- ── threads: add v2 columns ───────────────────────────────────────────────────
-- Existing columns (label, lenses[], member_entry_ids[], one_line_why, etc.) are kept.
-- New columns are additive.
alter table public.threads
  add column if not exists lens         text,
  add column if not exists domain       text,
  add column if not exists interior     boolean not null default false,
  add column if not exists label_ai     text,
  add column if not exists label_user   text,
  add column if not exists rope_id      uuid references public.ropes (id) on delete set null,
  add column if not exists temperature  real,
  add column if not exists private      boolean not null default false,
  add column if not exists dismissed    boolean not null default false;

create index if not exists threads_rope_id_idx
  on public.threads (rope_id) where rope_id is not null;
create index if not exists threads_owner_active
  on public.threads (owner, dismissed, span_end desc) where dismissed = false;

-- ── thread_members ────────────────────────────────────────────────────────────
create table if not exists public.thread_members (
  thread_id uuid not null references public.threads (id) on delete cascade,
  entry_id  uuid not null references public.entries (id) on delete cascade,
  register  text not null check (register in ('bringing', 'meeting', 'neutral')),
  primary key (thread_id, entry_id)
);

create index if not exists thread_members_entry_idx
  on public.thread_members (entry_id);

alter table public.thread_members enable row level security;
drop policy if exists "thread_members are private" on public.thread_members;
create policy "thread_members are private"
  on public.thread_members for all to authenticated
  using (exists (
    select 1 from public.threads t
    where t.id = thread_id and t.owner = auth.uid()
  ));
