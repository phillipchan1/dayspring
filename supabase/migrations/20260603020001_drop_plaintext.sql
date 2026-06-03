-- Phase 2: Remove the plaintext body_markdown column from entries_raw.
--
-- Run ONLY after verifying that migration 20260603020000 is working:
--   • SELECT count(*) FROM entries_raw WHERE body_encrypted IS NULL; → 0
--   • SELECT body_markdown FROM entries LIMIT 3; → real entry text (decrypted)
--   • The app reads and writes entries normally in production.
--
-- After this migration, the entries_raw table contains NO plaintext — only
-- pgsodium-encrypted bytea. A raw database dump is unreadable without the
-- pgsodium keystore.

BEGIN;

-- Confirm no unencrypted rows remain before dropping.
DO $$
DECLARE
  unencrypted int;
BEGIN
  SELECT count(*) INTO unencrypted FROM public.entries_raw
  WHERE body_encrypted IS NULL;

  IF unencrypted > 0 THEN
    RAISE EXCEPTION 'Aborting: % row(s) still have no body_encrypted. Run the backfill first.', unencrypted;
  END IF;
END;
$$;

-- Drop the plaintext column.
ALTER TABLE public.entries_raw DROP COLUMN IF EXISTS body_markdown;

-- Rebuild the view without the plaintext fallback (it no longer exists).
CREATE OR REPLACE VIEW public.entries
  WITH (security_invoker = true)
AS
SELECT
  id,
  owner,
  created_at,
  updated_at,
  title,
  mood,
  tags,
  word_count,
  source,
  external_id,
  COALESCE(private.decrypt_entry_body(id, body_encrypted), '') AS body_markdown
FROM public.entries_raw;

-- Re-grant (view recreation resets grants).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO anon;

-- Update the INSERT trigger: no longer references body_markdown column.
CREATE OR REPLACE FUNCTION private.entries_instead_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id    uuid := COALESCE(NEW.id, gen_random_uuid());
  v_owner uuid := COALESCE(NEW.owner, auth.uid());
BEGIN
  IF auth.uid() IS NOT NULL AND v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "entries"';
  END IF;

  INSERT INTO public.entries_raw (
    id, owner, created_at, updated_at,
    title, mood, tags, word_count, source, external_id,
    body_encrypted
  ) VALUES (
    v_id,
    v_owner,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now()),
    NEW.title,
    NEW.mood,
    COALESCE(NEW.tags, '{}'),
    COALESCE(NEW.word_count, 0),
    COALESCE(NEW.source, 'native'),
    NEW.external_id,
    CASE WHEN NEW.body_markdown IS NOT NULL AND NEW.body_markdown != ''
      THEN private.encrypt_entry_body(v_id, NEW.body_markdown)
      ELSE NULL
    END
  );

  NEW.id         := v_id;
  NEW.owner      := v_owner;
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  RETURN NEW;
END;
$$;

-- Update the UPDATE trigger: body_markdown column is gone from entries_raw.
CREATE OR REPLACE FUNCTION private.entries_instead_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "entries"';
  END IF;

  UPDATE public.entries_raw SET
    title         = NEW.title,
    mood          = NEW.mood,
    tags          = COALESCE(NEW.tags, OLD.tags),
    word_count    = COALESCE(NEW.word_count, OLD.word_count),
    source        = COALESCE(NEW.source, OLD.source),
    external_id   = NEW.external_id,
    body_encrypted = CASE
      WHEN NEW.body_markdown IS NOT NULL
        THEN private.encrypt_entry_body(OLD.id, NEW.body_markdown)
      ELSE (SELECT body_encrypted FROM public.entries_raw WHERE id = OLD.id)
    END
  WHERE id = OLD.id;

  RETURN NEW;
END;
$$;

COMMIT;
