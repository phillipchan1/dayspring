-- Ask — semantic retrieval over the whole journal.
--
-- The Altar's sweep already searches entries by cosine distance, but its RPC
-- (match_entries_for_thread) is windowed by `since` because an open-thread sweep
-- only cares about recent writing. Ask is the opposite question — "every time I
-- wrote about this, across everything" — so it needs the same search with no
-- time floor and a larger result budget.
--
-- Same safety shape as match_entries_for_thread: security definer with an
-- EXPLICIT owner filter, so the service-role caller (api/ask.ts, which holds the
-- OpenAI key needed to embed the question) stays owner-scoped even though it
-- bypasses RLS. The client never calls this directly and never sees an embedding.

create or replace function public.match_entries(
  query_embedding vector(1536),
  owner_id uuid,
  match_count int default 40,
  -- Optional bounds for date-anchored questions ("when dad was sick"). NULL on
  -- either side means unbounded — the common case.
  from_ts timestamptz default null,
  to_ts timestamptz default null
)
returns table (entry_id uuid, created_at timestamptz, distance float)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.created_at, (e.embedding <=> query_embedding) as distance
  from public.entries e
  where e.owner = owner_id
    and e.embedding is not null
    and e.superseded = false
    and (from_ts is null or e.created_at >= from_ts)
    and (to_ts   is null or e.created_at <= to_ts)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Lexical leg. Ask expands the question into the writer's own vocabulary via the
-- Concordance (NQ, "the prop account", …) and needs entries CONTAINING any of
-- those terms — recall, not ranking. ILIKE over a small single-owner corpus is
-- honest here; there is no tsvector in this schema and adding one would change
-- what "contains" means for a corpus full of proper nouns and shorthand.
create or replace function public.match_entries_lexical(
  owner_id uuid,
  terms text[],
  match_count int default 60,
  from_ts timestamptz default null,
  to_ts timestamptz default null
)
returns table (entry_id uuid, created_at timestamptz, hits int)
language sql stable security definer
set search_path = public
as $$
  select e.id,
         e.created_at,
         (select count(*)::int
            from unnest(terms) t
           where e.body_markdown ilike
                 '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%') as hits
  from public.entries e
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
$$;

-- Both are called only by the service-role worker (api/ask.ts holds the OpenAI
-- key needed to embed the question), so nothing else gets execute. Guarded on
-- role existence so the migration also applies to a bare Postgres without
-- Supabase's anon/authenticated roles.
do $$
declare
  fns text[] := array[
    'public.match_entries(vector, uuid, int, timestamptz, timestamptz)',
    'public.match_entries_lexical(uuid, text[], int, timestamptz, timestamptz)'
  ];
  fn text;
  r  text;
begin
  foreach fn in array fns loop
    execute format('revoke all on function %s from public', fn);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', fn, r);
      end if;
    end loop;
  end loop;
end $$;
