-- Migration: payment columns on profiles (Stripe Billing + RevenueCat/Apple IAP)
-- Supabase is the single source of truth for entitlement. Both Stripe (web) and
-- Apple IAP (iOS, via RevenueCat) write here; every surface reads the same plan field.
-- Idempotent — safe to re-run.

alter table public.profiles
  add column if not exists stripe_customer_id  text,
  add column if not exists apple_original_txn  text,
  add column if not exists plan                text not null default 'none'
    check (plan in ('none', 'trialing', 'active', 'cancelled', 'past_due')),
  add column if not exists plan_source         text
    check (plan_source in ('stripe', 'apple')),
  add column if not exists trial_ends_at       timestamptz,
  add column if not exists plan_expires_at     timestamptz;

-- Fast lookup when webhook fires with a Stripe customer ID and needs the owner.
create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
