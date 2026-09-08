-- Circumstances of writing: timezone, place, weather on each entry.
--
-- A client-visible column, so it joins ENTRY_COLUMNS, the updated_at trigger
-- allowlist, the realtime publication, upsert_entry_checked, and the
-- classification test in supabase/tests/multi_device_sync.test.sql.

alter table public.entries
  add column if not exists circumstances jsonb not null default '{}'::jsonb;

-- ── updated_at: circumstance is something the writer (or their device) set ──
create or replace function public.entries_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.created_at    is distinct from old.created_at
  or new.body_markdown is distinct from old.body_markdown
  or new.title         is distinct from old.title
  or new.mood          is distinct from old.mood
  or new.tags          is distinct from old.tags
  or new.word_count    is distinct from old.word_count
  or new.source        is distinct from old.source
  or new.external_id   is distinct from old.external_id
  or new.circumstances is distinct from old.circumstances then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

-- ── realtime: include the new column, still exclude embedding ───────────────
alter publication supabase_realtime drop table public.entries;
alter publication supabase_realtime add table public.entries
  (id, owner, created_at, updated_at, body_markdown, title, mood, tags,
   word_count, source, external_id, circumstances);

-- ── optimistic concurrency: carry circumstances through the push ────────────
drop function if exists public.upsert_entry_checked(
  uuid, timestamptz, text, text, text, text[], integer, text, text, timestamptz
);

create or replace function public.upsert_entry_checked(
  p_id              uuid,
  p_created_at      timestamptz,
  p_body_markdown   text,
  p_title           text,
  p_mood            text,
  p_tags            text[],
  p_word_count      integer,
  p_source          text,
  p_external_id     text,
  p_base_updated_at timestamptz,
  p_circumstances   jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  r public.entries;
  is_conflict boolean := false;
begin
  select * into r from public.entries e where e.id = p_id;

  if not found then
    insert into public.entries
      (id, created_at, body_markdown, title, mood, tags, word_count, source,
       external_id, circumstances)
    values
      (p_id, p_created_at, p_body_markdown, p_title, p_mood,
       coalesce(p_tags, '{}'), p_word_count, coalesce(p_source, 'native'),
       p_external_id, coalesce(p_circumstances, '{}'::jsonb))
    returning * into r;

  elsif r.updated_at is distinct from p_base_updated_at then
    is_conflict := true;

  else
    update public.entries e set
      created_at     = p_created_at,
      body_markdown  = p_body_markdown,
      title          = p_title,
      mood           = p_mood,
      tags           = coalesce(p_tags, '{}'),
      word_count     = p_word_count,
      source         = coalesce(p_source, 'native'),
      external_id    = p_external_id,
      circumstances  = coalesce(p_circumstances, '{}'::jsonb)
    where e.id = p_id
    returning * into r;
  end if;

  return jsonb_build_object(
    'conflicted', is_conflict,
    'entry', to_jsonb(r) - 'embedding' - 'owner'
  );
end;
$$;

grant execute on function public.upsert_entry_checked(
  uuid, timestamptz, text, text, text, text[], integer, text, text, timestamptz, jsonb
) to authenticated;
