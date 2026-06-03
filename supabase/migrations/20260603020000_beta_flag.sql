-- Feature flags array on profiles — replaces the is_beta boolean approach.
-- Each entry is a string token, e.g. 'beta', 'alpha', 'altar_v2'.
-- Grant access in Supabase dashboard: set feature_flags = '{beta}' for a user.

alter table public.profiles
  add column if not exists feature_flags text[] not null default '{}';
