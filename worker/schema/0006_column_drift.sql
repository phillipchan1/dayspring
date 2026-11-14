-- Column drift vs Supabase prod (diff of information_schema, Nov 2026).
-- Only drift that breaks or changes what the as-is Vercel code (api/**, src/**)
-- writes and reads. Every statement is idempotent; re-running is a no-op.
--
--   1. Legacy 0001 NOT NULL columns the app never writes (Supabase has no such
--      column): concordance.term, scripture_refs.canonical. Every gather and
--      concordance insert failed with 23502.
--   2. Types that differ from Supabase:
--        profiles.scripture_scan_watermark  timestamptz -> integer (client writes an int)
--        resurface_dismissals.source_id      uuid -> text  (Supabase is text)
--        scripture_refs.confidence           text -> real  (reads came back as strings)
--        welcome_drip_enrollments.enrolled_at timestamptz -> date (code slices YYYY-MM-DD)
--   3. Supabase column defaults the code relies on when it omits the column.
-- Not changed on purpose: owner uuid -> text (Better Auth ids), embeddings TEXT
-- (0005 casts), extra Neon-only nullable columns, and Neon columns that are
-- nullable where Supabase is NOT NULL (looser never breaks a write).
-- Apply at the switch, after the backup. Do not hand-apply to prod.

-- 1. Legacy NOT NULL columns.
ALTER TABLE concordance ALTER COLUMN term DROP NOT NULL;
ALTER TABLE scripture_refs ALTER COLUMN canonical DROP NOT NULL;

-- 2. Types.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'profiles' AND column_name = 'scripture_scan_watermark'
             AND data_type <> 'integer') THEN
    -- A timestamptz never held a valid scan watermark (an entry count); start from 0.
    ALTER TABLE profiles ALTER COLUMN scripture_scan_watermark DROP DEFAULT;
    ALTER TABLE profiles ALTER COLUMN scripture_scan_watermark TYPE integer USING NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'resurface_dismissals' AND column_name = 'source_id'
             AND data_type <> 'text') THEN
    ALTER TABLE resurface_dismissals ALTER COLUMN source_id TYPE text USING source_id::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'scripture_refs' AND column_name = 'confidence'
             AND data_type <> 'real') THEN
    ALTER TABLE scripture_refs ALTER COLUMN confidence DROP DEFAULT;
    ALTER TABLE scripture_refs ALTER COLUMN confidence TYPE real
      USING CASE WHEN confidence ~ '^\s*-?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?\s*$' THEN confidence::real END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'welcome_drip_enrollments' AND column_name = 'enrolled_at'
             AND data_type <> 'date') THEN
    ALTER TABLE welcome_drip_enrollments ALTER COLUMN enrolled_at DROP DEFAULT;
    ALTER TABLE welcome_drip_enrollments ALTER COLUMN enrolled_at TYPE date
      USING (enrolled_at AT TIME ZONE 'UTC')::date;
  END IF;
END
$do$;
UPDATE profiles SET scripture_scan_watermark = 0 WHERE scripture_scan_watermark IS NULL;
ALTER TABLE profiles ALTER COLUMN scripture_scan_watermark SET DEFAULT 0;
ALTER TABLE welcome_drip_enrollments ALTER COLUMN enrolled_at SET DEFAULT ((NOW() AT TIME ZONE 'UTC')::date);

-- 3. Supabase defaults.
ALTER TABLE concordance ALTER COLUMN confidence SET DEFAULT 0.4;
ALTER TABLE concordance ALTER COLUMN status SET DEFAULT 'suggested';
ALTER TABLE concordance_shadow ALTER COLUMN confidence SET DEFAULT 0.4;
ALTER TABLE concordance_shadow ALTER COLUMN status SET DEFAULT 'suggested';
ALTER TABLE encounters ALTER COLUMN named_at SET DEFAULT NOW();
ALTER TABLE processing_jobs ALTER COLUMN total SET DEFAULT 0;
ALTER TABLE profiles ALTER COLUMN plan SET DEFAULT 'none';
ALTER TABLE scripture_refs ALTER COLUMN confidence SET DEFAULT 1;
ALTER TABLE scripture_refs ALTER COLUMN status SET DEFAULT 'confirmed';
ALTER TABLE spiritual_items ALTER COLUMN source SET DEFAULT 'command';
ALTER TABLE threads ALTER COLUMN kind SET DEFAULT 'derived';
