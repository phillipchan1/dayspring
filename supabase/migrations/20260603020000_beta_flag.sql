-- Add is_beta flag to profiles for per-user feature gating.
-- Flip to true in the Supabase dashboard to grant beta access to a specific user.

alter table public.profiles
  add column if not exists is_beta boolean not null default false;
