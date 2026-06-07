-- Onboarding: first-run welcome / import flow.
--
-- Adds profiles.onboarded_at. A user is "first-run" when onboarded_at IS NULL:
-- they are routed into the welcome flow ahead of the editor, regardless of how
-- many entries they have. Completing either path (import finished, or fresh
-- "Begin writing") sets onboarded_at = now() so the flow never reappears.
--
-- Existing profiles are NOT brand-new users — they've already used the app — so
-- we stamp every row that exists at migration time as already onboarded. Only
-- rows created AFTER this migration (genuine new sign-ups) start NULL and see
-- the flow. Idempotent — safe to re-run.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Backfill: anyone who already has a profile row has been here before.
update public.profiles
  set onboarded_at = coalesce(onboarded_at, updated_at, now())
  where onboarded_at is null;
