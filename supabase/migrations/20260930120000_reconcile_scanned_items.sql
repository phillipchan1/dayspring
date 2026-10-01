-- reconcile_scanned_items — the harvest's one write, made atomic.
--
-- ── What was wrong ───────────────────────────────────────────────────────────
--
-- The prayer harvest wrote in two steps: insert the passages it found into
-- spiritual_items, THEN stamp entries.prayer_scanned_at. Nothing tied the two
-- together and the insert had no dedupe, so the same prayer could be planted
-- twice whenever
--
--   · the stamp (or anything after the insert) failed — the entry stayed
--     "unscanned" and the next run inserted the same rows again; or
--   · the daily synthesize cron and an import's altar_harvest job read the same
--     unscanned entries at the same time — both inserted.
--
-- A duplicate is not just a second row: the subject tagger reads every
-- harvested line once, so each duplicate was also paid for again.
--
-- ── What this does ───────────────────────────────────────────────────────────
--
-- For each entry, in ONE transaction, with the entry row locked so two callers
-- serialise:
--
--   1. delete the entry's scanned rows the harvest no longer returns;
--   2. insert only the passages that are not already there;
--   3. stamp prayer_scanned_at.
--
-- It RECONCILES rather than replaces on purpose. A row that survives keeps its
-- id — and with it its embedding, its subject tags and its thread membership —
-- so re-reading an entry never re-bills the tagger for a prayer that did not
-- change. Only source='scanned' rows are touched: a 'command' row is tied to a
-- fence in the editor and belongs to the client's save-time reconcile.
--
-- p_entries: [{ "entry_id": uuid, "created_at": timestamptz,
--               "items": [{ "type": "prayer"|"sense", "content": text }] }]
-- An entry with an empty items array is simply stamped (and loses any scanned
-- rows it had). Returns the number of rows inserted.

create or replace function public.reconcile_scanned_items(p_owner uuid, p_entries jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  e         jsonb;
  v_entry   uuid;
  v_items   jsonb;
  v_n       integer;
  v_planted integer := 0;
begin
  for e in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    v_entry := (e->>'entry_id')::uuid;
    v_items := coalesce(e->'items', '[]'::jsonb);

    -- Lock the page. A second caller holding the same entry waits here, then
    -- finds the rows already present and inserts nothing.
    perform 1 from entries where id = v_entry and owner = p_owner for update;
    if not found then
      continue; -- deleted since it was read, or not this owner's
    end if;

    delete from spiritual_items s
     where s.owner = p_owner
       and s.entry_id = v_entry
       and s.source = 'scanned'
       and not exists (
         select 1 from jsonb_array_elements(v_items) i
          where i->>'type' = s.type and i->>'content' = s.content
       );

    insert into spiritual_items (owner, entry_id, type, content, source, created_at)
    select p_owner, v_entry, d.type, d.content, 'scanned', (e->>'created_at')::timestamptz
      from (
        select distinct on (i.value->>'type', i.value->>'content')
               i.value->>'type'    as type,
               i.value->>'content' as content,
               i.ordinality        as ord
          from jsonb_array_elements(v_items) with ordinality i
         order by i.value->>'type', i.value->>'content', i.ordinality
      ) d
     where not exists (
       select 1 from spiritual_items s
        where s.owner = p_owner
          and s.entry_id = v_entry
          and s.source = 'scanned'
          and s.type = d.type
          and s.content = d.content
     )
     order by d.ord;
    get diagnostics v_n = row_count;
    v_planted := v_planted + v_n;

    update entries set prayer_scanned_at = now() where id = v_entry;
  end loop;

  return v_planted;
end;
$$;

-- Service role only: it takes an owner as an argument.
revoke all on function public.reconcile_scanned_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_scanned_items(uuid, jsonb) to service_role;
