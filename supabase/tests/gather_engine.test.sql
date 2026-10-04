-- Behaviour tests for migrations/20260930120000_reconcile_scanned_items.sql and
-- migrations/20260930130000_gather_engine.sql.
--
-- These cover what cannot be seen from the TypeScript side, where the functions
-- are doubles: that the harvest write really is idempotent, that an edit landing
-- mid-gather stays pending, and that the settle window and the give-up count do
-- what the engine assumes. Run against any throwaway Postgres 15+:
--
--   psql -h /tmp -p 55432 -U postgres -f supabase/tests/_fixture.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/migrations/20260930120000_reconcile_scanned_items.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/migrations/20260930130000_gather_engine.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/tests/gather_engine.test.sql
--
-- Every line of output should start with PASS; any failure raises and stops.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

truncate public.spiritual_items;
truncate public.entries cascade; -- cascade: entry_reads (20261004120000) references it
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000002') on conflict do nothing;

-- Four entries: read by nobody, read by everyone (then stamped by hand below, as
-- the cut-over UPDATE would), written a moment ago, and another owner's.
insert into public.entries (id, owner, body_markdown, updated_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'gathered already', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'never read',       now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'just written',     now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'someone else',     now() - interval '2 days');
alter table public.entries disable trigger entries_set_updated_at;
update public.entries set gathered_hash = body_hash where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 1. body_hash is Postgres's md5 of the body — the value the engine stamps back.
do $$
begin
  assert (select body_hash = md5('never read') from public.entries
           where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'body_hash is md5(body_markdown)';
  raise notice 'PASS  body_hash is md5(body_markdown), maintained by Postgres';
end $$;

-- 2. The settle window: a page touched a moment ago is pending but not READY.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  assert public.gather_pending_count(o, '30 minutes') = 1, 'only the settled entry is ready';
  assert public.gather_pending_count(o, '0 minutes')  = 2, 'an import (settle 0) reads both';
  assert (select count(*) from public.gather_pending_owners('30 minutes', 10)) = 2, 'two owners have work';
  assert (select id from public.gather_pending_entries(o, '30 minutes', 10))
           = 'aaaaaaaa-0000-0000-0000-000000000002', 'the ready entry is the one returned';
  raise notice 'PASS  an entry is ready only once it has sat untouched for the settle window';
end $$;

-- 3. The stamp records the hash that was READ: an edit mid-gather stays pending.
do $$
declare o  constant uuid := '00000000-0000-0000-0000-000000000001';
        e  constant uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
        h  text;
begin
  select body_hash into h from public.entries where id = e;
  -- the writer edits while the engine is still reading the old body
  update public.entries set body_markdown = 'never read, then edited' where id = e;
  perform public.gather_stamp(o, jsonb_build_array(
    jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w', 'ok', true)), 3);
  assert public.gather_pending_count(o, '30 minutes') = 1, 'the edit must still be pending';

  select body_hash into h from public.entries where id = e;
  perform public.gather_stamp(o, jsonb_build_array(
    jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w2', 'ok', true)), 3);
  assert public.gather_pending_count(o, '30 minutes') = 0, 'stamping the current hash clears it';
  raise notice 'PASS  an edit that lands mid-gather is not lost';
end $$;

-- 4. Failures count; the third stamps the entry anyway and starts the count over.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
        h text;
        r jsonb;
begin
  update public.entries set body_markdown = 'unreadable' where id = e;
  select body_hash into h from public.entries where id = e;
  r := jsonb_build_array(jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'never', 'ok', false));
  assert public.gather_stamp(o, r, 3) = 0;
  assert public.gather_stamp(o, r, 3) = 0;
  assert (select gather_attempts from public.entries where id = e) = 2, 'two attempts counted';
  assert public.gather_pending_count(o, '30 minutes') = 1, 'still pending after two failures';
  assert public.gather_stamp(o, r, 3) = 1, 'the third failure reports one entry given up';
  assert public.gather_pending_count(o, '30 minutes') = 0, 'a given-up entry leaves the queue';
  assert (select gather_attempts = 0 and gathered_words_hash = 'w2' from public.entries where id = e),
    'count restarts; words_hash is untouched so the next edit re-reads everything';
  raise notice 'PASS  an unreadable entry is given up on at the cap, not retried forever';
end $$;

-- 5. A stamp is scoped to the owner it is given.
do $$
declare e constant uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
begin
  perform public.gather_stamp('00000000-0000-0000-0000-000000000002', jsonb_build_array(
    jsonb_build_object('id', e, 'body_hash', 'forged', 'words_hash', 'x', 'ok', true)), 3);
  assert (select gathered_hash <> 'forged' from public.entries where id = e), 'another owner cannot stamp';
  raise notice 'PASS  gather_stamp only writes the given owner''s entries';
end $$;

-- 6. reconcile_scanned_items: idempotent, dated to the entry, stamps the entry.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
        harvest constant jsonb := jsonb_build_array(jsonb_build_object(
          'entry_id', e, 'created_at', '2026-01-05T12:00:00Z', 'items', jsonb_build_array(
            jsonb_build_object('type', 'prayer', 'content', 'Lord, help.'),
            jsonb_build_object('type', 'prayer', 'content', 'Father, thank you.'),
            jsonb_build_object('type', 'prayer', 'content', 'Lord, help.'))));
begin
  assert public.reconcile_scanned_items(o, harvest) = 2, 'one row per distinct passage';
  assert public.reconcile_scanned_items(o, harvest) = 0, 'a second identical run plants nothing';
  assert (select count(*) from public.spiritual_items where entry_id = e) = 2;
  assert (select bool_and(source = 'scanned' and created_at = '2026-01-05T12:00:00Z')
            from public.spiritual_items where entry_id = e), 'scanned, dated to the entry';
  assert (select prayer_scanned_at is not null from public.entries where id = e), 'entry stamped';
  raise notice 'PASS  the same harvest twice plants each prayer once';
end $$;

-- 7. A re-read reconciles: the survivor keeps its id (and so its tags and
--    thread), the vanished row goes, a /pray fence row is never touched.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
        kept uuid;
begin
  update public.spiritual_items set subject_tagged_at = now()
   where entry_id = e and content = 'Father, thank you.' returning id into kept;
  insert into public.spiritual_items (owner, entry_id, type, content, source)
  values (o, e, 'prayer', 'typed in a fence', 'command');

  assert public.reconcile_scanned_items(o, jsonb_build_array(jsonb_build_object(
    'entry_id', e, 'created_at', '2026-01-05T12:00:00Z', 'items', jsonb_build_array(
      jsonb_build_object('type', 'prayer', 'content', 'Father, thank you.'),
      jsonb_build_object('type', 'prayer', 'content', 'A new prayer.'))))) = 1, 'only the new passage is inserted';

  assert (select array_agg(content order by content) from public.spiritual_items where entry_id = e)
           = array['A new prayer.', 'Father, thank you.', 'typed in a fence'];
  assert (select id = kept and subject_tagged_at is not null from public.spiritual_items
           where entry_id = e and content = 'Father, thank you.'), 'the survivor is the same row, still tagged';
  raise notice 'PASS  a re-read keeps what still stands and never re-bills the tagger for it';
end $$;

-- 8. Another owner's entry, and an entry that no longer exists, are skipped.
do $$
declare e constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
begin
  assert public.reconcile_scanned_items('00000000-0000-0000-0000-000000000002', jsonb_build_array(
    jsonb_build_object('entry_id', e, 'created_at', now(), 'items', jsonb_build_array(
      jsonb_build_object('type', 'prayer', 'content', 'intruder'))))) = 0;
  assert public.reconcile_scanned_items('00000000-0000-0000-0000-000000000001', jsonb_build_array(
    jsonb_build_object('entry_id', 'bbbbbbbb-0000-0000-0000-000000000009', 'created_at', now(),
      'items', jsonb_build_array(jsonb_build_object('type', 'prayer', 'content', 'ghost'))))) = 0;
  assert not exists (select 1 from public.spiritual_items where content in ('intruder', 'ghost'));
  raise notice 'PASS  reconcile only writes to the given owner''s existing entries';
end $$;

-- 9. An empty harvest clears the scanned rows and nothing else.
do $$
declare e constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
begin
  perform public.reconcile_scanned_items('00000000-0000-0000-0000-000000000001', jsonb_build_array(
    jsonb_build_object('entry_id', e, 'created_at', now(), 'items', '[]'::jsonb)));
  assert (select array_agg(content) from public.spiritual_items where entry_id = e) = array['typed in a fence'];
  raise notice 'PASS  an entry with nothing to harvest loses its scanned rows, keeps its fence rows';
end $$;

-- 10. The engine's functions are not callable by a signed-in user.
do $$
begin
  assert not has_function_privilege('authenticated', 'public.gather_stamp(uuid, jsonb, integer)', 'execute');
  assert not has_function_privilege('anon', 'public.reconcile_scanned_items(uuid, jsonb)', 'execute');
  assert has_function_privilege('service_role', 'public.gather_pending_owners(interval, integer)', 'execute');
  insert into public.processing_jobs (kind) values ('gather');
  raise notice 'PASS  service-role only, and processing_jobs accepts the gather kind';
end $$;

alter table public.entries enable trigger entries_set_updated_at;
