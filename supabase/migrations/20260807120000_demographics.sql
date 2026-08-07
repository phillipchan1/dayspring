-- Passive demographics — who is actually using Dayspring, without asking anyone
-- anything. Every column here is either already known to the client (platform,
-- device shape, timezone, locale), already known to the edge (country/region
-- from the request), or a choice the user made in a flow we already run
-- (onboarding_path, signup_provider). Nothing new is collected FROM the user.
--
-- Why this exists: DECISIONS.md D-003 ("Instrument the onboarding fork") is the
-- cheapest high-value action open, and D-002 (is fresh-start a viable
-- acquisition path?) is blocked on it. PERSONAS.md is explicitly hypotheses
-- rather than findings; these columns are how the hypotheses get tested.
--
-- GUARDRAIL — read before using any of this:
--
--   This data informs Phil's roadmap decisions. It NEVER renders back to a
--   user, in any form, ever.
--
-- The moment age/region/platform sits next to entry counts, "users like you
-- write 3x a week" becomes a two-line query — and that is a verdict with extra
-- steps (Principle 1: light, not verdict; D-006, which leans NO on answering
-- "is this normal?" for exactly this reason). Aggregate reads happen offline in
-- scripts/demographics.ts. No API route serves these columns to the client.
--
-- Deliberately ABSENT: age, gender, ethnicity. Those cannot be observed, only
-- guessed, and a guess stored in a column stops looking like a guess to the
-- next query that reads it. scripts/demographics.ts estimates the age and
-- gender *distribution* from first names at population level, where the errors
-- average out, and writes nothing back. See that file's header for the limits.
--
-- Note also that a Dayspring account already implies religious belief, which is
-- special-category data under GDPR Art. 9. That is a reason to keep this table
-- to observed facts and to keep inferred attributes out of it entirely.

alter table public.profiles
  -- Distribution channel this account was last seen on.
  add column if not exists platform text,
  -- Every channel this account has EVER been seen on. A user who writes on the
  -- desktop app and reads on their phone is one of the more interesting things
  -- we can learn, and `platform` alone (last seen) would hide it.
  add column if not exists platforms text[] not null default '{}',
  -- Device shape, independent of channel — a phone browser is 'web' + 'phone'.
  -- This is what actually answers "how many of my users are on a phone?".
  add column if not exists form_factor text,
  -- IANA zone from the client. Preferred over IP geolocation for region: it
  -- survives VPNs, and it is the field that tells us when people write.
  add column if not exists timezone text,
  -- BCP-47 from the browser (e.g. "en-US").
  add column if not exists locale text,
  -- ISO-3166-1 alpha-2, from the edge (x-vercel-ip-country).
  add column if not exists country text,
  -- Subdivision code, when the platform provides one.
  add column if not exists region text,
  -- Which button they signed up with. First write wins — later sign-ins with a
  -- linked second provider must not overwrite how the account actually started.
  add column if not exists signup_provider text,
  -- Which side of the onboarding fork they took. This is the D-003 payload: the
  -- veteran/fresh split was a live persona experiment we were not reading.
  add column if not exists onboarding_path text,
  -- Last /api/profile/ensure call, i.e. last app open. Lets every distribution
  -- below be filtered to accounts that are actually still active.
  add column if not exists last_seen_at timestamptz;

-- Constrain the enums at the DB rather than trusting the client, which supplies
-- platform/form_factor. Written as NOT VALID-free plain checks because the
-- table is small and every existing row is NULL, which all three allow.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_platform_check') then
    alter table public.profiles add constraint profiles_platform_check
      check (platform is null or platform in ('web', 'desktop', 'ios', 'android'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_form_factor_check') then
    alter table public.profiles add constraint profiles_form_factor_check
      check (form_factor is null or form_factor in ('phone', 'tablet', 'desktop'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_signup_provider_check') then
    alter table public.profiles add constraint profiles_signup_provider_check
      check (signup_provider is null or signup_provider in ('google', 'apple'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_onboarding_path_check') then
    alter table public.profiles add constraint profiles_onboarding_path_check
      check (
        onboarding_path is null
        or onboarding_path in ('import', 'fresh', 'import_deferred')
      );
  end if;
end $$;

-- RLS is unchanged: the existing "profiles are private to owner" policy already
-- covers every column on this table, so a user can read their own row and no
-- one else's. The aggregate report reads with the service role, offline.
