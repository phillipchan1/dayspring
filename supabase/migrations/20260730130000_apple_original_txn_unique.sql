-- Make `apple_original_txn` unique, replacing the plain lookup index.
--
-- The lookup index (added in 20260730120000_apple_iap_columns.sql) makes the
-- App Store Server Notification path fast, but it permits the state it exists
-- to prevent: two Dayspring profiles pointing at ONE App Store subscription.
-- That happens for real — a user signs in with Google, subscribes, then signs
-- in again with Apple and taps "Restore purchases". Without uniqueness both
-- accounts end up entitled off a single $7/month, and any later cancellation
-- notification only lands on whichever row the update happened to match.
--
-- /api/apple/verify already rejects a cross-account claim in application code;
-- this is the database making the same guarantee unconditionally.
--
-- Idempotent — safe to re-run.

-- Guard: if duplicates already exist, fail loudly with the offending ids rather
-- than letting CREATE UNIQUE INDEX emit an opaque error.
do $$
declare
  dupes text;
begin
  select string_agg(apple_original_txn, ', ')
    into dupes
  from (
    select apple_original_txn
    from public.profiles
    where apple_original_txn is not null
    group by apple_original_txn
    having count(*) > 1
  ) d;

  if dupes is not null then
    raise exception
      'Cannot add unique index: these Apple original transaction ids are claimed by more than one profile: %', dupes;
  end if;
end $$;

create unique index if not exists profiles_apple_original_txn_key
  on public.profiles (apple_original_txn)
  where apple_original_txn is not null;

-- The non-unique index is now redundant — the unique one serves the same reads.
drop index if exists public.profiles_apple_original_txn_idx;
