-- Extra Apple IAP bookkeeping on profiles (StoreKit + RevenueCat / ASN).
-- Idempotent — safe to re-run.

alter table public.profiles
  add column if not exists apple_product_id   text,
  add column if not exists apple_environment  text
    check (apple_environment is null or apple_environment in ('Sandbox', 'Production')),
  add column if not exists apple_last_txn_id  text,
  add column if not exists apple_updated_at   timestamptz;

-- Lookup renewals / ASN by original transaction id when appAccountToken is absent.
create index if not exists profiles_apple_original_txn_idx
  on public.profiles (apple_original_txn)
  where apple_original_txn is not null;
