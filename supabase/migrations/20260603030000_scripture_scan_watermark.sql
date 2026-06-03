-- Move the scripture scan watermark from localStorage into the profiles table so
-- it follows the account across devices. The value is the imported-entry count at
-- the last scan or dismiss; the CTA shows while importedCount > watermark.
alter table public.profiles
  add column if not exists scripture_scan_watermark integer not null default 0;
