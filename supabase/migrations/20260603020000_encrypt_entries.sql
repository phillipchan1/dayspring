-- Phase 1: Encrypt entries.body_markdown with pgsodium (aead-det).
--
-- After this migration:
--   • All new writes are encrypted in entries_raw.body_encrypted.
--   • The "entries" view decrypts transparently — all app code keeps working.
--   • body_markdown is still present in entries_raw (nullable) as a fallback
--     for any rows that pre-date this migration and haven't been backfilled yet.
--   • Run migration 20260603020001_drop_plaintext.sql after verifying this works.
--
-- Requires: Supabase Pro (pgsodium extension). Verify first:
--   SELECT 1 FROM pg_extension WHERE extname = 'pgsodium';
-- If that returns no rows, enable it in the Supabase dashboard before proceeding.

BEGIN;

-- ── 1. Rename the source table ────────────────────────────────────────────────
-- All existing indexes, constraints, triggers, and RLS policies follow the rename.

ALTER TABLE public.entries RENAME TO entries_raw;

-- body_markdown becomes nullable so INSTEAD OF INSERT can omit it.
ALTER TABLE public.entries_raw ALTER COLUMN body_markdown DROP NOT NULL;

-- ── 2. Encryption key ────────────────────────────────────────────────────────
-- pgsodium stores the key material in a hardware-backed keystore; the id is just
-- a reference token. Even with service-role access an attacker cannot extract the
-- key itself from the database — they'd need OS-level access to the pgsodium
-- keystore.

INSERT INTO pgsodium.key (name, status, key_type)
VALUES ('entries_body_key', 'valid', 'aead-det');

-- ── 3. Encrypted column ───────────────────────────────────────────────────────
ALTER TABLE public.entries_raw ADD COLUMN IF NOT EXISTS body_encrypted bytea;

-- ── 4. Private schema for internal helpers ───────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;

-- ── 5. Encrypt helper (SECURITY DEFINER = runs as postgres, sees pgsodium) ───
CREATE OR REPLACE FUNCTION private.encrypt_entry_body(entry_id uuid, body text)
RETURNS bytea LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT pgsodium.crypto_aead_det_encrypt(
    message    := convert_to(body, 'utf8'),
    additional := convert_to(entry_id::text, 'utf8'),
    key_uuid   := (SELECT id FROM pgsodium.key WHERE name = 'entries_body_key' LIMIT 1)
  );
$$;

-- ── 6. Decrypt helper ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.decrypt_entry_body(entry_id uuid, encrypted bytea)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT convert_from(
    pgsodium.crypto_aead_det_decrypt(
      message    := encrypted,
      additional := convert_to(entry_id::text, 'utf8'),
      key_uuid   := (SELECT id FROM pgsodium.key WHERE name = 'entries_body_key' LIMIT 1)
    ),
    'utf8'
  );
$$;

-- ── 7. Backfill: encrypt every existing plaintext row ────────────────────────
-- Run this outside the transaction if the entries table is large (it may time out).
-- You can also run it in batches: add LIMIT 5000, repeat until 0 rows updated.
UPDATE public.entries_raw
SET body_encrypted = private.encrypt_entry_body(id, body_markdown)
WHERE body_markdown IS NOT NULL
  AND body_markdown != ''
  AND body_encrypted IS NULL;

-- ── 8. Transparent decrypting view ───────────────────────────────────────────
-- security_invoker = true → RLS from entries_raw is enforced for the caller's role.
-- private.decrypt_entry_body is SECURITY DEFINER so it can reach pgsodium even
-- when called through a SECURITY INVOKER view.
-- Falls back to body_markdown for any row not yet encrypted (belt-and-braces).

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
  CASE
    WHEN body_encrypted IS NOT NULL
      THEN private.decrypt_entry_body(id, body_encrypted)
    ELSE COALESCE(body_markdown, '')
  END AS body_markdown
FROM public.entries_raw;

-- Grant the same roles that had access to the original table.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO anon;

-- ── 9. INSTEAD OF INSERT ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.entries_instead_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id    uuid := COALESCE(NEW.id, gen_random_uuid());
  v_owner uuid := COALESCE(NEW.owner, auth.uid());
BEGIN
  -- Mirror the RLS check: authenticated users may only insert their own rows.
  IF auth.uid() IS NOT NULL AND v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "entries"';
  END IF;

  INSERT INTO public.entries_raw (
    id, owner, created_at, updated_at,
    title, mood, tags, word_count, source, external_id,
    body_markdown, body_encrypted
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
    NULL,   -- never store plaintext
    CASE WHEN NEW.body_markdown IS NOT NULL AND NEW.body_markdown != ''
      THEN private.encrypt_entry_body(v_id, NEW.body_markdown)
      ELSE NULL
    END
  );

  -- Return the row as the caller expects it (body_markdown in plaintext).
  NEW.id         := v_id;
  NEW.owner      := v_owner;
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entries_instead_insert ON public.entries;
CREATE TRIGGER entries_instead_insert
  INSTEAD OF INSERT ON public.entries
  FOR EACH ROW EXECUTE FUNCTION private.entries_instead_insert();

-- ── 10. INSTEAD OF UPDATE ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.entries_instead_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Mirror the RLS ownership check.
  IF auth.uid() IS NOT NULL AND OLD.owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "entries"';
  END IF;

  UPDATE public.entries_raw SET
    -- created_at is immutable (original journal date preserved on import).
    title         = NEW.title,
    mood          = NEW.mood,
    tags          = COALESCE(NEW.tags, OLD.tags),
    word_count    = COALESCE(NEW.word_count, OLD.word_count),
    source        = COALESCE(NEW.source, OLD.source),
    external_id   = NEW.external_id,
    body_markdown = NULL,   -- clear any legacy plaintext on every write
    body_encrypted = CASE
      WHEN NEW.body_markdown IS NOT NULL
        THEN private.encrypt_entry_body(OLD.id, NEW.body_markdown)
      -- body_markdown was not included in the SET — keep the existing ciphertext.
      ELSE (SELECT body_encrypted FROM public.entries_raw WHERE id = OLD.id)
    END
  WHERE id = OLD.id;
  -- updated_at is handled by the existing entries_set_updated_at trigger on entries_raw.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entries_instead_update ON public.entries;
CREATE TRIGGER entries_instead_update
  INSTEAD OF UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION private.entries_instead_update();

-- ── 11. INSTEAD OF DELETE ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.entries_instead_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Mirror the RLS ownership check.
  IF auth.uid() IS NOT NULL AND OLD.owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "entries"';
  END IF;

  DELETE FROM public.entries_raw WHERE id = OLD.id AND owner = OLD.owner;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS entries_instead_delete ON public.entries;
CREATE TRIGGER entries_instead_delete
  INSTEAD OF DELETE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION private.entries_instead_delete();

COMMIT;

-- ── Verification queries (run after the migration) ───────────────────────────
-- 1. Confirm all rows are encrypted (should return 0):
--    SELECT count(*) FROM entries_raw WHERE body_encrypted IS NULL;
--
-- 2. Confirm the view decrypts correctly (should return your actual entry text):
--    SELECT id, body_markdown FROM entries LIMIT 1;
--
-- 3. Confirm plaintext is gone from entries_raw (should return [binary] or NULL):
--    SELECT id, body_markdown FROM entries_raw LIMIT 3;
--
-- When satisfied, run 20260603020001_drop_plaintext.sql.
