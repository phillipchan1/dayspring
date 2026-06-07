-- Scope import dedup per owner. The original unique index was global on
-- (source, external_id), so two different users importing from the same app
-- could collide on a shared external_id (e.g. both have a 2023-01-15 entry) —
-- one user's import would conflict against the other's row and fail under RLS.
-- Make it (owner, source, external_id). Native entries have a null external_id,
-- and nulls are distinct in a unique index, so they never collide. Required
-- before multiple real users. See docs/MULTI_TENANCY_PLAN.md.

drop index if exists public.entries_source_external_id_key;

create unique index if not exists entries_owner_source_external_id_key
  on public.entries (owner, source, external_id);
