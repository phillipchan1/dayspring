-- Behaviour tests for migrations/20260801120000_multi_device_sync.sql and
-- migrations/20260823120000_derived_writes_dont_touch_updated_at.sql.
--
-- These cover the parts that are easy to get subtly wrong and impossible to
-- notice from the client: which side of a conflict is returned, whether a
-- conflict writes anything, and whether a server-derived write looks like a user
-- edit. Run against any throwaway Postgres 15+ (no Supabase needed):
--
--   initdb -D /tmp/pg -U postgres -A trust
--   pg_ctl -D /tmp/pg -o '-p 55432 -k /tmp' start
--   psql -h /tmp -p 55432 -U postgres -f supabase/tests/_fixture.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/migrations/20260801120000_multi_device_sync.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/migrations/20260823120000_derived_writes_dont_touch_updated_at.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/tests/multi_device_sync.test.sql
--
-- Every line of output should start with PASS; any failure raises and stops.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

-- Each DO block is its own transaction: the trigger uses now(), which is
-- transaction time, so steps that must produce DIFFERENT timestamps have to be
-- committed separately (as they are in production, one push per request).

truncate public.entries;
create temp table t (k text primary key, v text);

-- 1. INSERT via the RPC when the row does not exist.
do $$
declare r jsonb;
begin
  r := public.upsert_entry_checked('11111111-1111-1111-1111-111111111111'::uuid, now(),
        'first body', null, null, array['a']::text[], 2, 'native', null, null);
  assert (r->>'conflicted')::boolean = false, 'insert should not conflict';
  assert r->'entry'->>'body_markdown' = 'first body', 'insert body';
  assert not (r->'entry' ? 'embedding'), 'embedding must never be returned to the client';
  assert not (r->'entry' ? 'owner'), 'owner must not be returned';
  insert into t values ('base', r->'entry'->>'updated_at');
  raise notice 'PASS  insert via RPC';
end $$;

-- 2. Matching base → the write goes through and updated_at advances.
do $$
declare r jsonb; base timestamptz := (select v::timestamptz from t where k = 'base');
begin
  r := public.upsert_entry_checked('11111111-1111-1111-1111-111111111111'::uuid, now(),
        'second body', null, null, array['a']::text[], 2, 'native', null, base);
  assert (r->>'conflicted')::boolean = false, 'a matching base must not conflict';
  assert r->'entry'->>'body_markdown' = 'second body', 'update applied';
  assert (r->'entry'->>'updated_at')::timestamptz > base, 'updated_at advanced';
  raise notice 'PASS  update with a matching base';
end $$;

-- 3. Stale base → nothing written, THEIR row returned.
do $$
declare r jsonb; base timestamptz := (select v::timestamptz from t where k = 'base');
begin
  r := public.upsert_entry_checked('11111111-1111-1111-1111-111111111111'::uuid, now(),
        'third body from another device', null, null, array['a']::text[], 4, 'native', null, base);
  assert (r->>'conflicted')::boolean = true, 'a stale base must conflict';
  assert r->'entry'->>'body_markdown' = 'second body',
    'a conflict must return the SERVER row, not the attempted write';
  assert (select body_markdown from public.entries where id = '11111111-1111-1111-1111-111111111111') = 'second body',
    'a conflict must write nothing';
  raise notice 'PASS  stale base conflicts, writes nothing, returns their row';
end $$;

-- 4. Null base against an existing row → conflict (another device got there
--    first, or our own insert response was lost in flight).
do $$
declare r jsonb;
begin
  r := public.upsert_entry_checked('11111111-1111-1111-1111-111111111111'::uuid, now(),
        'x', null, null, array[]::text[], 1, 'native', null, null);
  assert (r->>'conflicted')::boolean = true, 'a null base on an existing row must conflict';
  raise notice 'PASS  null base on an existing row conflicts';
end $$;

-- 5. An embedding-only write must NOT bump updated_at (the backfill case).
do $$
declare before timestamptz := (select updated_at from public.entries where id = '11111111-1111-1111-1111-111111111111');
begin
  update public.entries set embedding = array[0.1, 0.2]::real[]
   where id = '11111111-1111-1111-1111-111111111111';
  assert (select updated_at from public.entries where id = '11111111-1111-1111-1111-111111111111') = before,
    'an embedding-only write must leave updated_at alone';
  insert into t values ('afterEmbed', before::text);
  raise notice 'PASS  embedding-only write does not bump updated_at';
end $$;

-- 6. A real edit still bumps it.
do $$
declare before timestamptz := (select v::timestamptz from t where k = 'afterEmbed');
begin
  update public.entries set body_markdown = 'edited'
   where id = '11111111-1111-1111-1111-111111111111';
  assert (select updated_at from public.entries where id = '11111111-1111-1111-1111-111111111111') > before,
    'an ordinary edit must bump updated_at';
  raise notice 'PASS  ordinary edit still bumps updated_at';
end $$;

-- 7. A write touching body AND embedding is a real edit.
do $$
declare before timestamptz := (select updated_at from public.entries where id = '11111111-1111-1111-1111-111111111111');
begin
  update public.entries set body_markdown = 'edited again', embedding = array[0.3]::real[]
   where id = '11111111-1111-1111-1111-111111111111';
  assert (select updated_at from public.entries where id = '11111111-1111-1111-1111-111111111111') > before,
    'a write touching both must bump updated_at';
  raise notice 'PASS  mixed body+embedding write bumps updated_at';
end $$;

-- 8. The server owns updated_at — a client cannot forge it.
do $$
begin
  update public.entries set updated_at = now() + interval '10 years', body_markdown = 'clock skew'
   where id = '11111111-1111-1111-1111-111111111111';
  assert (select updated_at from public.entries where id = '11111111-1111-1111-1111-111111111111')
         < now() + interval '1 minute',
    'the trigger must overwrite a client-supplied updated_at';
  raise notice 'PASS  server owns updated_at even when a client sends one';
end $$;

-- 9. The publication no longer carries the embedding column.
select case
  when exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'entries'
      and 'embedding' = any(attnames)
  ) then 'FAIL  embedding is still published'
  else 'PASS  embedding excluded from the realtime publication'
end;

-- 10. ...but still carries everything the client actually reads.
select case
  when (select attnames::text[] from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'entries')
       @> array['id','created_at','updated_at','body_markdown','title','mood','tags','word_count','source','external_id']
  then 'PASS  all client-read columns still published'
  else 'FAIL  a column the client reads is missing from the publication'
end;

-- ── updated_at belongs to the user's writing, not to server bookkeeping ─────
-- 20260823120000_derived_writes_dont_touch_updated_at.sql. A derived-column
-- write that bumps updated_at doesn't just cost bandwidth: updated_at is the
-- base an optimistic push declares, so moving it under a device that is being
-- typed on manufactures a conflict nobody caused — and the client resolves that
-- conflict by forking the entry. The daily cron did this with prayer_scanned_at
-- and concordance_scanned_at.

-- Each case below parks updated_at on a sentinel far in the past (trigger off),
-- applies ONE column's write, and asks whether updated_at moved. Comparing
-- against a sentinel rather than against the previous value is what lets the
-- whole sweep share a transaction: the trigger's now() is transaction time, so
-- consecutive real timestamps inside one DO block would be identical.
create or replace function pg_temp.stamp_moved(p_id uuid, set_clause text) returns boolean
language plpgsql as $$
declare sentinel constant timestamptz := '2000-01-01 00:00:00Z';
        after timestamptz;
begin
  alter table public.entries disable trigger entries_set_updated_at;
  update public.entries set updated_at = sentinel where id = p_id;
  alter table public.entries enable trigger entries_set_updated_at;

  execute format('update public.entries set %s where id = %L', set_clause, p_id);
  select updated_at into after from public.entries where id = p_id;
  return after <> sentinel;
end $$;

-- 11. Every server-derived column: writing it must leave updated_at alone.
do $$
declare id uuid := '11111111-1111-1111-1111-111111111111';
        clause text;
begin
  foreach clause in array array[
    $c$embedding = coalesce(embedding, '{}'::real[]) || 0.9::real$c$,
    $c$prayer_scanned_at = coalesce(prayer_scanned_at, 'epoch'::timestamptz) + interval '1 day'$c$,
    $c$concordance_scanned_at = coalesce(concordance_scanned_at, 'epoch'::timestamptz) + interval '1 day'$c$,
    $c$superseded = not superseded$c$,
    $c$entry_lens = coalesce(entry_lens, '') || 'x'$c$,
    $c$entry_domain = coalesce(entry_domain, '') || 'x'$c$
  ] loop
    assert not pg_temp.stamp_moved(id, clause),
      format('a derived write must not bump updated_at: %s', clause);
  end loop;
  raise notice 'PASS  no server-derived column bumps updated_at';
end $$;

-- 12. Every column the client can see: changing it MUST still bump updated_at.
--     The mirror of 11 — an exemption that swallowed a real edit would stop it
--     ever reaching the user's other devices.
do $$
declare id uuid := '11111111-1111-1111-1111-111111111111';
        clause text;
begin
  foreach clause in array array[
    $c$created_at = created_at + interval '1 day'$c$,
    $c$body_markdown = body_markdown || 'x'$c$,
    $c$title = coalesce(title, '') || 'x'$c$,
    $c$mood = coalesce(mood, '') || 'x'$c$,
    $c$tags = tags || 'x'::text$c$,
    $c$word_count = word_count + 1$c$,
    $c$source = case when source = 'native' then 'other' else 'native' end$c$,
    $c$external_id = coalesce(external_id, '') || 'x'$c$
  ] loop
    assert pg_temp.stamp_moved(id, clause),
      format('a user-visible edit must bump updated_at: %s', clause);
  end loop;
  raise notice 'PASS  every client-visible column still bumps updated_at';
end $$;

-- 13. A no-op update must not bump — nothing changed, so nothing to re-sync.
do $$
declare id uuid := '11111111-1111-1111-1111-111111111111';
begin
  assert not pg_temp.stamp_moved(id, 'body_markdown = body_markdown'),
    'writing a column its own value must not bump updated_at';
  raise notice 'PASS  a no-op update does not bump updated_at';
end $$;

-- 14. A client cannot forge updated_at on its own, with no real edit beside it.
--     (8 covers the same forgery alongside a genuine edit.)
do $$
declare id uuid := '11111111-1111-1111-1111-111111111111';
begin
  assert not pg_temp.stamp_moved(id, $c$updated_at = now() + interval '10 years'$c$),
    'a bare updated_at write must not stick';
  raise notice 'PASS  updated_at alone cannot be forged';
end $$;

-- 15. Every column of `entries` is deliberately classified as one or the other.
--     This is the guard that keeps the bug from coming back: the original was a
--     denylist naming `embedding`, so the next derived column defaulted to
--     "bumps" and nobody noticed. Adding ANY column now fails this test until
--     someone writes down which side it is on (and, if client-visible, adds it
--     to the trigger and to ENTRY_COLUMNS in src/lib/entries.ts).
do $$
declare
  identity_cols constant text[] := array['id', 'owner', 'updated_at'];
  -- Mirrors ENTRY_COLUMNS in src/lib/entries.ts.
  synced_cols   constant text[] := array['created_at', 'body_markdown', 'title', 'mood',
                                         'tags', 'word_count', 'source', 'external_id'];
  derived_cols  constant text[] := array['embedding', 'prayer_scanned_at', 'concordance_scanned_at',
                                         'superseded', 'entry_lens', 'entry_domain'];
  unclassified  text[];
begin
  select coalesce(array_agg(a.attname order by a.attname), '{}')
    into unclassified
    from pg_attribute a
   where a.attrelid = 'public.entries'::regclass
     and a.attnum > 0 and not a.attisdropped
     and not (a.attname = any(identity_cols || synced_cols || derived_cols));
  assert cardinality(unclassified) = 0,
    format('unclassified column(s) on entries: %s — decide whether each is a user edit '
           'or server bookkeeping, then update entries_touch_updated_at and this test',
           array_to_string(unclassified, ', '));
  raise notice 'PASS  every entries column is classified as user-visible or derived';
end $$;
