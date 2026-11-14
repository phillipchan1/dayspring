-- Worker port of the Vercel jobs and AI routes (Nov 2026).
-- Brings the Neon schema to what the as-is Vercel code (api/_lib/*) expects:
--   1. entries.body_hash: generated md5(body_markdown), as in Supabase.
--   2. The unique indexes the Vercel code's upserts and dedupe depend on.
--   3. The 9 Supabase RPCs, with owner as TEXT (Better Auth ids) instead of uuid.
--   4. pgvector for the 3 similarity RPCs. Neon stores embeddings as TEXT
--      ('[0.1,…]', pgvector's text form), so those RPCs cast embedding::vector.
-- pgvector parts run only where the extension is available (Neon has it; the CI
-- postgres:17 image and plain PGlite don't), so check:worker keeps passing.
-- Apply at the switch, after the backup. Do not hand-apply to prod.

-- 1. Generated column used by the gather engine.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS body_hash TEXT GENERATED ALWAYS AS (md5(body_markdown)) STORED;

-- 2. Unique indexes from Supabase that Neon was missing.
CREATE UNIQUE INDEX IF NOT EXISTS altar_candidates_thread_id_key ON altar_candidates (thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS concordance_active_identity
  ON concordance (owner, kind, lower(canonical)) WHERE (status <> 'superseded');
CREATE UNIQUE INDEX IF NOT EXISTS concordance_occurrences_cid_eid
  ON concordance_occurrences (concordance_id, entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS echo_dismissals_owner_entry_idx ON echo_dismissals (owner, entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS encounters_thread_ref_uniq ON encounters (thread_ref) WHERE (thread_ref IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS encounters_thread_id_key ON encounters (thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS insights_period_key
  ON insights (owner, type, period_start, period_end)
  WHERE (type = ANY (ARRAY['weekly', 'monthly', 'quarterly', 'yearly']));
CREATE UNIQUE INDEX IF NOT EXISTS item_subjects_dedup ON item_subjects (item_id, subject_id);
CREATE UNIQUE INDEX IF NOT EXISTS marks_entry_quote_uq ON marks (entry_id, md5(quote));
CREATE UNIQUE INDEX IF NOT EXISTS processing_jobs_one_active
  ON processing_jobs (owner, kind) WHERE (status = ANY (ARRAY['queued', 'running']));
CREATE UNIQUE INDEX IF NOT EXISTS resurface_dismissals_owner_type_id_idx
  ON resurface_dismissals (owner, source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS scripture_refs_dedup ON scripture_refs (entry_id, osis_ref);
CREATE UNIQUE INDEX IF NOT EXISTS thread_members_entry_uniq
  ON thread_members (thread_id, entry_id) WHERE (entry_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS thread_members_item_uniq
  ON thread_members (thread_id, spiritual_item_id) WHERE (spiritual_item_id IS NOT NULL);

-- 3. RPCs (bodies as in Supabase prod; owner uuid → text).
CREATE OR REPLACE FUNCTION claim_processing_jobs(k integer)
 RETURNS SETOF processing_jobs
 LANGUAGE sql
AS $function$
  update processing_jobs
     set status = 'running', locked_at = now(), attempts = attempts + 1
   where id in (
     select id from processing_jobs
      where status in ('queued','running')
        and (locked_at is null or locked_at < now() - interval '5 minutes')
      order by created_at
      for update skip locked
      limit k
   )
  returning *;
$function$;

CREATE OR REPLACE FUNCTION gather_pending_count(p_owner text, p_settle interval)
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  select count(*)
    from entries e
   where e.owner = p_owner
     and e.gathered_hash is distinct from e.body_hash
     and e.updated_at <= now() - p_settle;
$function$;

CREATE OR REPLACE FUNCTION gather_pending_entries(p_owner text, p_settle interval, p_limit integer)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, body_markdown text, body_hash text, gathered_hash text, gathered_words_hash text, gather_attempts smallint, prayer_scanned boolean, concordance_scanned boolean, embedded boolean)
 LANGUAGE sql
 STABLE
AS $function$
  select e.id, e.created_at, e.body_markdown, e.body_hash,
         e.gathered_hash, e.gathered_words_hash, e.gather_attempts,
         e.prayer_scanned_at is not null,
         e.concordance_scanned_at is not null,
         e.embedding is not null
    from entries e
   where e.owner = p_owner
     and e.gathered_hash is distinct from e.body_hash
     and e.updated_at <= now() - p_settle
   order by e.created_at desc, e.id
   limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION gather_pending_owners(p_settle interval, p_limit integer)
 RETURNS TABLE(owner text, pending bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select e.owner, count(*) as pending
    from entries e
   where e.gathered_hash is distinct from e.body_hash
     and e.updated_at <= now() - p_settle
   group by e.owner
   order by min(e.updated_at)
   limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION gather_stamp(p_owner text, p_rows jsonb, p_max_attempts integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_given_up integer;
begin
  update entries e
     set gathered_hash       = r.body_hash,
         gathered_words_hash = r.words_hash,
         gather_attempts     = 0
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(id uuid, body_hash text, words_hash text, ok boolean)
   where e.id = r.id and e.owner = p_owner and r.ok;

  with failed as (
    update entries e
       set gathered_hash   = case when e.gather_attempts + 1 >= p_max_attempts
                                  then r.body_hash else e.gathered_hash end,
           gather_attempts = case when e.gather_attempts + 1 >= p_max_attempts
                                  then 0 else e.gather_attempts + 1 end
      from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as r(id uuid, body_hash text, words_hash text, ok boolean)
     where e.id = r.id and e.owner = p_owner and not r.ok
    returning (e.gather_attempts = 0) as gave_up
  )
  select count(*) filter (where gave_up) into v_given_up from failed;

  return coalesce(v_given_up, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION match_entries_lexical(owner_id text, terms text[], match_count integer DEFAULT 60, from_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, to_ts timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(entry_id uuid, created_at timestamp with time zone, hits integer)
 LANGUAGE sql
 STABLE
AS $function$
  select e.id,
         e.created_at,
         (select count(*)::int
            from unnest(terms) t
           where e.body_markdown ilike
                 '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%') as hits
  from entries e
  where e.owner = owner_id
    and e.superseded = false
    and (from_ts is null or e.created_at >= from_ts)
    and (to_ts   is null or e.created_at <= to_ts)
    and exists (
      select 1 from unnest(terms) t
      where e.body_markdown ilike
            '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by e.created_at desc
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION reconcile_scanned_items(p_owner text, p_entries jsonb)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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

    perform 1 from entries where id = v_entry and owner = p_owner for update;
    if not found then
      continue;
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
$function$;

-- 4. pgvector + similarity RPCs (embedding is TEXT in Neon → cast).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION match_entries(query_embedding vector, owner_id text, match_count integer DEFAULT 40, from_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, to_ts timestamp with time zone DEFAULT NULL::timestamp with time zone)
       RETURNS TABLE(entry_id uuid, created_at timestamp with time zone, distance double precision)
       LANGUAGE sql
       STABLE
      AS $body$
        select e.id, e.created_at, (e.embedding::vector <=> query_embedding) as distance
        from entries e
        where e.owner = owner_id
          and e.embedding is not null
          and e.superseded = false
          and (from_ts is null or e.created_at >= from_ts)
          and (to_ts   is null or e.created_at <= to_ts)
        order by e.embedding::vector <=> query_embedding
        limit match_count;
      $body$
    $f$;
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION match_entries_for_thread(query_embedding vector, owner_id text, since timestamp with time zone, match_count integer DEFAULT 8)
       RETURNS TABLE(entry_id uuid, created_at timestamp with time zone, distance double precision)
       LANGUAGE sql
       STABLE
      AS $body$
        select e.id, e.created_at, (e.embedding::vector <=> query_embedding) as distance
        from entries e
        where e.owner = owner_id
          and e.embedding is not null
          and e.created_at >= since
        order by e.embedding::vector <=> query_embedding
        limit match_count;
      $body$
    $f$;
  END IF;
END
$do$;
