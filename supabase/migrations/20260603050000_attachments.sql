-- Image attachment storage: metadata table + Supabase Storage bucket + RLS.
-- Run once in the Supabase SQL editor. Idempotent — safe to re-run.

-- 1. Metadata table: one row per unique (owner, content-hash) pair.
--    Lets us skip re-uploading known images and track per-user storage usage.
create table if not exists public.attachments (
  id          uuid        primary key default gen_random_uuid(),
  owner       uuid        not null references auth.users on delete cascade,
  hash        text        not null,          -- SHA-256 hex of the file content
  storage_key text        not null,          -- '<owner>/<hash>.<ext>' in the bucket
  mime        text,
  bytes       integer,
  created_at  timestamptz not null default now(),
  unique (owner, hash)
);

alter table public.attachments enable row level security;

create policy "attachments: owner full access"
  on public.attachments for all
  to authenticated
  using  (owner = auth.uid())
  with check (owner = auth.uid());

-- 2. Storage bucket: private, 50 MB per-file cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  52428800,
  array['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/heic','image/heif']
)
on conflict (id) do nothing;

-- 3. Storage RLS: each user may only touch objects under their own UID prefix.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
    and policyname = 'attachments storage: owner upload'
  ) then
    create policy "attachments storage: owner upload"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'attachments' and
        (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
    and policyname = 'attachments storage: owner read'
  ) then
    create policy "attachments storage: owner read"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'attachments' and
        (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
    and policyname = 'attachments storage: owner delete'
  ) then
    create policy "attachments storage: owner delete"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'attachments' and
        (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
