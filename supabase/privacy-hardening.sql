-- Privacy hardening steps to run in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Run each section independently so you can verify results before proceeding.
-- These are READ-ONLY audit queries first, then the hardening writes.

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Verify RLS is enabled on every user table
-- Expected: rls_enabled = true for all rows. If any row shows false, run the
-- ALTER TABLE below for that table.
-- ─────────────────────────────────────────────────────────────────────────────

select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
    'entries', 'insights', 'spiritual_items', 'prayer_threads',
    'encounters', 'altar_candidates', 'altar_candidate_dismissals',
    'echo_candidates', 'echo_dismissals', 'scripture_refs',
    'reminders', 'profiles'
  )
order by tablename;

-- If any table shows rls_enabled = false, run:
-- ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Verify every user table has an owner-scoped policy
-- Expected: one "private to owner" policy per table.
-- ─────────────────────────────────────────────────────────────────────────────

select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Confirm no user can read another user's entries via direct SQL
-- Replace <user_a_id> and <user_b_id> with real UUIDs from auth.users.
-- This should return 0 rows when run as user B's JWT.
-- (Run this from a Supabase client authenticated as user B, not from the dashboard.)
-- ─────────────────────────────────────────────────────────────────────────────

-- select count(*) from entries where owner = '<user_a_id>';
-- Expected: 0


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Enable Supabase Vault for column-level encryption
-- This encrypts entries.body_markdown so that a raw database dump is unreadable.
-- The encryption key lives in pgsodium, NOT in application code.
-- Requires Supabase Pro plan or higher.
--
-- WARNING: This is a destructive migration. Test on a staging project first.
-- After this migration, all reads/writes to body_markdown go through the view.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 4a: Enable pgsodium (already enabled on Supabase Pro)
-- create extension if not exists pgsodium;

-- Step 4b: Create a named encryption key
-- insert into pgsodium.key (name, status, key_type)
-- values ('entries_body_key', 'valid', 'aead-det')
-- returning id;  -- save this UUID as ENTRIES_KEY_ID

-- Step 4c: Add an encrypted shadow column
-- alter table public.entries
--   add column body_encrypted bytea;

-- Step 4d: Backfill — encrypt existing plaintext (run once)
-- update public.entries
-- set body_encrypted = pgsodium.crypto_aead_det_encrypt(
--   message   := convert_to(body_markdown, 'utf8'),
--   additional := convert_to(id::text, 'utf8'),
--   key_uuid  := '<ENTRIES_KEY_ID>'
-- )
-- where body_encrypted is null;

-- Step 4e: Create a security invoker view that transparently decrypts
-- create or replace view public.entries_decrypted
-- security invoker as
-- select
--   id, owner, created_at, updated_at, title, mood, tags, word_count, source, external_id,
--   convert_from(
--     pgsodium.crypto_aead_det_decrypt(
--       message   := body_encrypted,
--       additional := convert_to(id::text, 'utf8'),
--       key_uuid  := '<ENTRIES_KEY_ID>'
--     ),
--     'utf8'
--   ) as body_markdown
-- from public.entries;

-- Step 4f (after verifying the view works): drop the plaintext column
-- alter table public.entries drop column body_markdown;

-- Application code change required: point all queries at entries_decrypted instead of entries.


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Enable Supabase database audit logging
-- Logs every query (with timestamp, role, and table) to Supabase Log Explorer.
-- Does NOT log row contents — just the operation. Go to:
--   Dashboard → Settings → Database → "Enable audit logging"
-- Or run the pgaudit extension:
-- ─────────────────────────────────────────────────────────────────────────────

-- create extension if not exists pgaudit;
-- alter system set pgaudit.log = 'read, write';
-- select pg_reload_conf();


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Restrict service-role key access (network level)
-- Dashboard → Settings → Database → "Allowed IP addresses"
-- Add only your Vercel deployment IPs. Vercel publishes its CIDR list at:
--   https://vercel.com/docs/security/deployment-protection/methods-to-protect-all-routes
-- This ensures the service-role key can only be used from Vercel functions,
-- not from arbitrary machines even if the key leaks.
-- ─────────────────────────────────────────────────────────────────────────────

-- (No SQL required — do this in the Supabase dashboard)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: Remove APP_OWNER_ID from Vercel environment variables
-- Now that cron jobs are multi-tenant, this variable is no longer referenced
-- in code. Remove it from:
--   Vercel Dashboard → Project → Settings → Environment Variables
-- ─────────────────────────────────────────────────────────────────────────────

-- (No SQL required)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: OpenAI Zero Data Retention
-- On paid OpenAI plans you can opt your organization out of training data use.
--   platform.openai.com → Settings → Privacy → "Zero Data Retention"
-- Also sign the OpenAI Data Processing Addendum (DPA) if testers are in the EU.
-- ─────────────────────────────────────────────────────────────────────────────

-- (No SQL required)
