-- Altar perf: bulk-write embeddings in one statement per batch instead of one
-- UPDATE per row. The historical backfill embeds thousands of entries; doing a
-- round-trip per row dominated the runtime. These set-based helpers take parallel
-- arrays of (id, vector-literal) and update in a single statement.
--
-- security definer + an explicit owner filter keeps them owner-scoped even though
-- the service-role worker (backfill/cron) bypasses RLS. `embs` is text[] of pgvector
-- literals ('[0.1,0.2,...]'), cast to vector inside — avoids any client-side
-- vector binding quirks.

create or replace function public.set_entry_embeddings(owner_id uuid, ids uuid[], embs text[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.entries e
     set embedding = v.emb::vector
    from unnest(ids, embs) as v(id, emb)
   where e.id = v.id
     and e.owner = owner_id;
$$;

create or replace function public.set_item_embeddings(owner_id uuid, ids uuid[], embs text[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.spiritual_items s
     set embedding = v.emb::vector
    from unnest(ids, embs) as v(id, emb)
   where s.id = v.id
     and s.owner = owner_id;
$$;
