-- Email suppression list (Nov 2026). The Worker sends remind / welcome-drip mail
-- through Cloudflare Email Sending, so Resend's per-contact unsubscribe state no
-- longer gates sends. Every Worker mail send checks this table first.
-- Sources: 'resend' (scripts/resend-suppressions.mjs import), 'one-click'
-- (/api/email/unsubscribe), 'mailto' (manual, see docs/email-suppressions.md).
-- Idempotent: safe to re-run. Neon only; Supabase / Vercel are unchanged.
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email      text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> ''),
  source     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
