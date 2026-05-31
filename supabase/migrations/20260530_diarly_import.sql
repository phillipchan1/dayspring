-- Diarly import support (run once in the Supabase SQL editor against the
-- existing Phase 1 database). Idempotent — safe to re-run.

-- 1. Allow 'diarly' as an entries.source value.
alter table public.entries drop constraint if exists entries_source_check;
alter table public.entries
  add constraint entries_source_check
  check (source in ('native', 'day_one', 'diarly', 'other'));

-- 2. Dedup target for idempotent imports: a NON-partial unique index on
--    (source, external_id). Phase 1 shipped a partial index (… where
--    external_id is not null), but Supabase upserts pass a bare
--    onConflict: 'source,external_id', and Postgres cannot infer a partial
--    index from a bare column list — so re-create it without the predicate.
--    Native rows have a null external_id and nulls are distinct in a unique
--    index, so they are never deduped against each other.
drop index if exists public.entries_source_external_id_key;
create unique index if not exists entries_source_external_id_key
  on public.entries (source, external_id);
