-- Multi-device sync hardening. Three independent changes, all safe to re-run.
--
-- 1. Server-side enrichment stops looking like a user edit.
-- 2. The realtime payload stops carrying the 1536-float embedding vector.
-- 3. upsert_entry_checked(): optimistic concurrency, so a push can detect that
--    another device wrote the row and hand back their version instead of
--    silently overwriting it.

-- ── 1. Embedding writes must not bump updated_at ────────────────────────────
-- The backfill and the daily cron do `UPDATE entries SET embedding = ...`, which
-- fired entries_set_updated_at and bumped every touched row. Clients treat
-- updated_at as "this changed", so one backfill made every device re-download the
-- entire library over `listEntriesSince` — and on a phone, over cell data.
-- An embedding is derived server-side; it is not something the user wrote.
create or replace function public.entries_touch_updated_at()
returns trigger language plpgsql as $$
begin
  -- Only the embedding changed → leave the timestamp where it was.
  if new.embedding is distinct from old.embedding
     and (to_jsonb(new) - 'embedding' - 'updated_at')
       = (to_jsonb(old) - 'embedding' - 'updated_at') then
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.entries_touch_updated_at();

-- ── 2. Keep the embedding out of realtime ───────────────────────────────────
-- postgres_changes ships the whole row. Without a column list every entry UPDATE
-- broadcasts 1536 floats to every connected device. A publication column list
-- (PG15+) drops it at the source. The replica-identity column (id) is included,
-- as Postgres requires.
--
-- NOTE: deliberately NOT adding a row filter here. With the default replica
-- identity a DELETE's old record carries only the primary key, so a filter such
-- as `owner=eq.<uid>` would never match and cross-device deletes would silently
-- stop arriving.
alter publication supabase_realtime drop table public.entries;
alter publication supabase_realtime add table public.entries
  (id, owner, created_at, updated_at, body_markdown, title, mood, tags,
   word_count, source, external_id);

-- ── 3. Optimistic concurrency for entry pushes ──────────────────────────────
-- The client pushed a blind upsert, so when two devices had both edited an entry
-- the later push simply destroyed the earlier one's writing with no trace. This
-- writes only when the server's copy is still the version the edit was based on;
-- otherwise it changes nothing and returns the current row, letting the client
-- preserve both sides.
--
-- security invoker (the default) so RLS still scopes every statement to the
-- owner. Returns jsonb rather than a column list: no name collisions with the
-- table's columns, no drift when a column is added, and `embedding`/`owner` are
-- dropped explicitly so the vector never reaches the client.
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
  p_base_updated_at timestamptz
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
      (id, created_at, body_markdown, title, mood, tags, word_count, source, external_id)
    values
      (p_id, p_created_at, p_body_markdown, p_title, p_mood,
       coalesce(p_tags, '{}'), p_word_count, coalesce(p_source, 'native'), p_external_id)
    returning * into r;

  elsif r.updated_at is distinct from p_base_updated_at then
    -- Written by another device since the base this edit came from. Touch
    -- nothing; hand back their version and let the client decide.
    is_conflict := true;

  else
    update public.entries e set
      created_at    = p_created_at,
      body_markdown = p_body_markdown,
      title         = p_title,
      mood          = p_mood,
      tags          = coalesce(p_tags, '{}'),
      word_count    = p_word_count,
      source        = coalesce(p_source, 'native'),
      external_id   = p_external_id
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
  uuid, timestamptz, text, text, text, text[], integer, text, text, timestamptz
) to authenticated;
