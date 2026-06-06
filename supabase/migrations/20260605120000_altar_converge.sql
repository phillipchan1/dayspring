-- Altar → Threads & Ropes convergence (Phase 0).
--
-- WHY: Altar v1 (prayer_threads + spiritual_items.thread_id, line-level, daily
-- cron) and Threads/Ropes (threads + thread_members + ropes, entry-level, offline
-- derivation) are two parallel cluster engines. Per the "Threads & Ropes — The
-- Reflective Spine" spec, a prayer is just a DECLARED thread and "Altar" is a lens
-- on the one field, not a separate place. This migration unifies the model so
-- declared prayer/sense threads live alongside derived entry threads:
--
--   threads.kind   declared (you marked it /pray or /sense) | derived (woven from prose)
--   threads.type   prayer | sense  (null for derived)
--   thread_members polymorphic: points at an entry_id OR a spiritual_item_id
--
-- Polymorphic members keep a declared prayer thread anchored to the EXACT /pray
-- line (not the whole entry that happened to contain it), so the thread stays pure
-- and its across-time arc shows the actual prayer text.
--
-- Purely additive + idempotent. No existing rows are destroyed; derived threads
-- written by derive-threads.ts default to kind='derived' with no behaviour change.

-- ── threads: declared/derived + prayer/sense + declared seed ──────────────────
-- A declared thread is a SUBJECT you keep bringing to God (a person/place/theme),
-- not a repeated phrase. subject_kind drives field hue and the "names you keep
-- bringing to God" view (subject_kind='person').
alter table public.threads
  add column if not exists kind         text not null default 'derived',
  add column if not exists type         text,
  add column if not exists subject_kind text,
  add column if not exists seed_item_id uuid references public.spiritual_items (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'threads_kind_chk') then
    alter table public.threads
      add constraint threads_kind_chk check (kind in ('declared', 'derived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'threads_type_chk') then
    alter table public.threads
      add constraint threads_type_chk check (type is null or type in ('prayer', 'sense'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'threads_subject_kind_chk') then
    alter table public.threads
      add constraint threads_subject_kind_chk
      check (subject_kind is null or subject_kind in ('person', 'place', 'theme'));
  end if;
end $$;

create index if not exists threads_kind_type_idx
  on public.threads (owner, kind, type) where dismissed = false;

-- ── thread_members: polymorphic member (entry OR spiritual_item) ──────────────
-- The composite PK (thread_id, entry_id) assumed every member was an entry. Swap
-- to a surrogate PK so a member can instead be a declared /pray or /sense line.
alter table public.thread_members
  add column if not exists id                uuid default gen_random_uuid(),
  add column if not exists spiritual_item_id uuid references public.spiritual_items (id) on delete cascade;

update public.thread_members set id = gen_random_uuid() where id is null;
alter table public.thread_members alter column id set not null;

do $$
begin
  -- Replace the composite PK with the surrogate id PK FIRST — entry_id cannot drop
  -- NOT NULL while it is still part of the primary key.
  if exists (
    select 1 from pg_constraint
    where conname = 'thread_members_pkey'
      and conrelid = 'public.thread_members'::regclass
      and array_length(conkey, 1) = 2
  ) then
    alter table public.thread_members drop constraint thread_members_pkey;
    alter table public.thread_members add constraint thread_members_pkey primary key (id);
  end if;

  -- Exactly one of entry_id / spiritual_item_id must be set.
  if not exists (select 1 from pg_constraint where conname = 'thread_members_source_chk') then
    alter table public.thread_members
      add constraint thread_members_source_chk
      check ((entry_id is not null)::int + (spiritual_item_id is not null)::int = 1);
  end if;
end $$;

-- Now that entry_id is no longer in the PK, it can be nullable (declared members
-- carry spiritual_item_id instead).
alter table public.thread_members alter column entry_id drop not null;

-- Dedup per kind (a thread holds an entry / item at most once).
create unique index if not exists thread_members_entry_uniq
  on public.thread_members (thread_id, entry_id) where entry_id is not null;
create unique index if not exists thread_members_item_uniq
  on public.thread_members (thread_id, spiritual_item_id) where spiritual_item_id is not null;
create index if not exists thread_members_item_idx
  on public.thread_members (spiritual_item_id) where spiritual_item_id is not null;

-- ── encounters: attach to the unified threads table (forward-compat) ──────────
-- v1 encounters reference prayer_threads.thread_id; the converged surface names
-- encounters on threads.id via thread_ref. Keep both during the cutover.
alter table public.encounters
  add column if not exists thread_ref uuid references public.threads (id) on delete cascade;

alter table public.encounters alter column thread_id drop not null;

create unique index if not exists encounters_thread_ref_uniq
  on public.encounters (thread_ref) where thread_ref is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'encounters_one_thread_chk') then
    alter table public.encounters
      add constraint encounters_one_thread_chk
      check (thread_id is not null or thread_ref is not null);
  end if;
end $$;

-- Senses are tested, not "answered" — extend the movement vocabulary so a sense
-- thread can be crowned with its own honest words (held / weighing / borne out /
-- confirmed / released), distinct from a prayer's. Testing prophecy is the user's
-- discernment (1 Thess 5:21), never the model's.
do $$
begin
  alter table public.encounters drop constraint if exists encounters_movement_check;
  alter table public.encounters
    add constraint encounters_movement_check
    check (movement in (
      'answered', 'redirected', 'he_met_me', 'surrendered', 'he_changed_me',
      'held', 'weighing', 'borne_out', 'confirmed', 'released'
    ));
end $$;
