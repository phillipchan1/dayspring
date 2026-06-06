-- Optional photo metadata (capture time, etc.) — keyed by content hash.
alter table public.attachments
  add column if not exists metadata jsonb not null default '{}';
