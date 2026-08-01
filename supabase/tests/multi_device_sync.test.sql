-- Behaviour tests for migrations/20260801120000_multi_device_sync.sql.
--
-- These cover the parts that are easy to get subtly wrong and impossible to
-- notice from the client: which side of a conflict is returned, whether a
-- conflict writes anything, and whether an embedding backfill looks like a user
-- edit. Run against any throwaway Postgres 15+ (no Supabase needed):
--
--   initdb -D /tmp/pg -U postgres -A trust
--   pg_ctl -D /tmp/pg -o '-p 55432 -k /tmp' start
--   psql -h /tmp -p 55432 -U postgres -f supabase/tests/_fixture.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/migrations/20260801120000_multi_device_sync.sql
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
