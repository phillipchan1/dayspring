-- The "All set — your reflections, scripture map, and altar are ready" banner
-- dismissal was tracked only in localStorage, so it reappeared on every new
-- device/browser (localStorage is per-device, not per-account). Move it to
-- profiles, alongside has_seen_welcome/onboarded_at, so dismissing it once
-- follows the account everywhere.

alter table public.profiles
  add column if not exists acked_processing_completion text;
