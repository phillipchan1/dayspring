-- Persist user settings in profiles so they sync across devices (desktop ↔ web).
-- Stored as JSONB so we can evolve the schema without more migrations.
-- Empty object {} means "no saved preferences" — fall back to client defaults.
alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;
