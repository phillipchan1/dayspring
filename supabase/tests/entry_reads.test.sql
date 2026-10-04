-- Behaviour tests for migrations/20261004120000_entry_reads.sql: the read-aware
-- gather queue and stamp. What they prove is what the engine assumes and cannot
-- see from TypeScript (where these functions are doubles):
--
--   · with p_read off, the queue is exactly the old one — the flag is inert;
--   · with p_read on, an already-gathered archive becomes pending for the read
--     ONLY, and leaves the queue once read;
--   · an edit re-queues the read; a given-up read leaves the queue.
--
-- Run after the gather engine migration (see gather_engine.test.sql):
--
--   psql -h /tmp -p 55432 -U postgres -f supabase/migrations/20261004120000_entry_reads.sql
--   psql -h /tmp -p 55432 -U postgres -f supabase/tests/entry_reads.test.sql
--
-- Every line of output should start with PASS; any failure raises and stops.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

truncate public.entry_reads;
truncate public.spiritual_items;
delete from public.entries;
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000002') on conflict do nothing;

-- Three of owner 1's entries, all settled: one gathered by the old scanners (cut
-- over: gathered_hash set, gathered_words_hash null — the bulk of a real
-- archive), one gathered by the engine, one never gathered. And owner 2's.
insert into public.entries (id, owner, body_markdown, updated_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'cut over',       now() - interval '2 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'engine gathered', now() - interval '2 days'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'never gathered',  now() - interval '2 days'),
  ('bbbbbbbb-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'someone else',    now() - interval '2 days');
alter table public.entries disable trigger entries_set_updated_at;
update public.entries set gathered_hash = body_hash
 where id in ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002',
              'bbbbbbbb-0000-0000-0000-000000000004');
update public.entries set gathered_words_hash = 'w2' where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- 1. p_read off (and omitted): the old queue, exactly.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  assert public.gather_pending_count(o, '30 minutes') = 1, 'omitted p_read: only the never-gathered entry';
  assert public.gather_pending_count(o, '30 minutes', false) = 1, 'p_read off: only the never-gathered entry';
  assert (select count(*) from public.gather_pending_owners('30 minutes', 10)) = 1, 'one owner has gather work';
  assert (select count(*) from public.gather_pending_entries(o, '30 minutes', 10)) = 1;
  raise notice 'PASS  with the read off, the queue is the old one';
end $$;

-- 2. p_read on: every entry with no read is pending, each counted once.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  assert public.gather_pending_count(o, '30 minutes', true) = 3,
    'the archive is pending for its read; the never-gathered entry is not counted twice';
  assert (select count(*) from public.gather_pending_owners('30 minutes', 10, true)) = 2, 'both owners have read work';
  assert (select pending from public.gather_pending_owners('30 minutes', 10, true)
           where owner = o) = 3, 'owner pending is per entry, not per reason';
  assert (select count(*) from public.gather_pending_entries(o, '30 minutes', 10, true)) = 3;
  assert (select bool_and(read_words_hash is null) from public.gather_pending_entries(o, '30 minutes', 10, true)),
    'the entries come back with their (missing) read hash';
  raise notice 'PASS  with the read on, an already-gathered archive is queued for its read';
end $$;

-- 3. Reading a cut-over entry clears it from BOTH queues and fills in its words hash.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
        h text;
begin
  select body_hash into h from public.entries where id = e;
  perform public.gather_stamp(o, jsonb_build_array(
    jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w1', 'read_hash', 'w1', 'ok', true)), 3);
  assert (select gathered_words_hash = 'w1' and read_words_hash = 'w1' from public.entries where id = e);
  assert public.gather_pending_count(o, '30 minutes', true) = 2, 'the read entry left the queue';
  raise notice 'PASS  a read entry leaves the queue';
end $$;

-- 4. A stamp with no read_hash (the read was not asked for) leaves the read alone.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
        h text;
begin
  select body_hash into h from public.entries where id = e;
  perform public.gather_stamp(o, jsonb_build_array(
    jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w3', 'ok', true)), 3);
  assert (select read_words_hash is null from public.entries where id = e), 'no read_hash, no read stamped';
  assert public.gather_pending_count(o, '30 minutes', false) = 0, 'gathered: off the old queue';
  assert public.gather_pending_count(o, '30 minutes', true) = 2, 'but still owed its read';
  raise notice 'PASS  an old-shape stamp (read off) does not mark a read done';
end $$;

-- 5. An edit to the writer's words re-queues the read once it is gathered.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
        h text;
begin
  update public.entries set body_markdown = 'cut over, then edited' where id = e;
  select body_hash into h from public.entries where id = e;
  -- gathered with the read OFF: words hash moves, read hash does not
  perform public.gather_stamp(o, jsonb_build_array(
    jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w1b', 'ok', true)), 3);
  assert (select read_words_hash = 'w1' and gathered_words_hash = 'w1b' from public.entries where id = e);
  assert e in (select id from public.gather_pending_entries(o, '30 minutes', 10, true)),
    'a stale read is pending when the read is turned on';
  raise notice 'PASS  a stale read (words changed since) is queued again';
end $$;

-- 6. A read the model cannot make is given up at the cap and leaves the queue.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
        h text;
        r jsonb;
begin
  select body_hash into h from public.entries where id = e;
  r := jsonb_build_array(jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w2', 'read_hash', 'w2', 'ok', false));
  assert public.gather_stamp(o, r, 3) = 0;
  assert public.gather_stamp(o, r, 3) = 0;
  assert e in (select id from public.gather_pending_entries(o, '30 minutes', 10, true)), 'retried before the cap';
  assert public.gather_stamp(o, r, 3) = 1, 'the third failure gives up';
  assert e not in (select id from public.gather_pending_entries(o, '30 minutes', 10, true)),
    'a given-up read leaves the queue instead of being retried every minute';
  raise notice 'PASS  an unreadable page leaves the read queue at the cap';
end $$;

-- 7. Same for a cut-over entry (no gathered_words_hash): the give-up still sticks.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000002';
        e constant uuid := 'bbbbbbbb-0000-0000-0000-000000000004';
        h text;
        r jsonb;
begin
  select body_hash into h from public.entries where id = e;
  r := jsonb_build_array(jsonb_build_object('id', e, 'body_hash', h, 'words_hash', 'w4', 'read_hash', 'w4', 'ok', false));
  perform public.gather_stamp(o, r, 3);
  perform public.gather_stamp(o, r, 3);
  perform public.gather_stamp(o, r, 3);
  assert public.gather_pending_count(o, '30 minutes', true) = 0, 'given up with no prior words hash';
  raise notice 'PASS  a given-up read on a cut-over entry leaves the queue';
end $$;

-- 8. The table: one row per entry, deleted with it, checks its bounds.
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001';
        e constant uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
begin
  insert into public.entry_reads (entry_id, owner, version, words_hash, present, valence, activation, confidence, emotions)
  values (e, o, 'v', 'w3', true, -0.4, 0.6, 0.8, '[{"emotion":"stress","intensity":0.7,"quote":"tense"}]');
  begin
    insert into public.entry_reads (entry_id, owner, version, words_hash, valence)
    values ('bbbbbbbb-0000-0000-0000-000000000002', o, 'v', 'w2', 3);
    raise exception 'valence 3 should have been rejected';
  exception when check_violation then null;
  end;
  delete from public.entries where id = e;
  assert not exists (select 1 from public.entry_reads where entry_id = e), 'a read goes with its entry';
  assert (select relrowsecurity from pg_class where oid = 'public.entry_reads'::regclass), 'RLS is on';
  assert not has_function_privilege('authenticated',
    'public.gather_pending_entries(uuid, interval, integer, boolean)', 'execute'), 'service role only';
  raise notice 'PASS  entry_reads is one bounded, owner-scoped row per entry';
end $$;

alter table public.entries enable trigger entries_set_updated_at;
