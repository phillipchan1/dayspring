-- Dayspring Neon schema (Better Auth + journal tables).
-- No auth.users, no RLS, no storage.objects, no supabase_realtime.
-- Access is enforced in worker/src/store.ts (owner = store.ownerId).
-- Synthetic / isolation only in this PR — do not apply to prod Supabase.

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body_markdown TEXT NOT NULL DEFAULT '',
  title TEXT,
  mood TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  word_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'native',
  external_id TEXT,
  circumstances JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding TEXT,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  entry_lens TEXT,
  entry_domain TEXT,
  prayer_scanned_at TIMESTAMPTZ,
  concordance_scanned_at TIMESTAMPTZ,
  gathered_hash TEXT,
  gathered_words_hash TEXT,
  gather_attempts SMALLINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS entries_owner_source_external_id_key
  ON entries (owner, source, external_id);
CREATE INDEX IF NOT EXISTS entries_owner_created_at_idx ON entries (owner, created_at DESC);

DROP TRIGGER IF EXISTS entries_set_updated_at ON entries;
CREATE TRIGGER entries_set_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  lens TEXT,
  period_start DATE,
  period_end DATE,
  source_ids UUID[] NOT NULL DEFAULT '{}',
  content_markdown TEXT,
  structured_payload JSONB NOT NULL DEFAULT '{}',
  source_model TEXT,
  pushed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS insights_owner_type_idx ON insights (owner, type, period_start DESC);
DROP TRIGGER IF EXISTS insights_set_updated_at ON insights;
CREATE TRIGGER insights_set_updated_at
  BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  has_seen_welcome BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_customer_id TEXT,
  apple_original_txn TEXT UNIQUE,
  plan TEXT,
  plan_source TEXT,
  trial_ends_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  feature_flags TEXT[] NOT NULL DEFAULT '{}',
  scripture_scan_watermark TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}',
  onboarded_at TIMESTAMPTZ,
  apple_product_id TEXT,
  apple_environment TEXT,
  apple_last_txn_id TEXT,
  apple_updated_at TIMESTAMPTZ,
  acked_processing_completion BOOLEAN NOT NULL DEFAULT FALSE,
  app_lock JSONB
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS spiritual_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  embedding TEXT,
  thread_id UUID,
  source TEXT,
  subject_tags JSONB,
  subject_tagged_at TIMESTAMPTZ,
  char_start INTEGER,
  char_end INTEGER
);

CREATE INDEX IF NOT EXISTS spiritual_items_owner_type_idx ON spiritual_items (owner, type);

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  fired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reminders_owner_remind_at_idx ON reminders (owner, remind_at);

CREATE TABLE IF NOT EXISTS echo_candidates (
  owner TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS echo_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resurface_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scripture_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  book TEXT,
  chapter INTEGER,
  verse_start INTEGER,
  verse_end INTEGER,
  source TEXT,
  confidence TEXT,
  status TEXT,
  char_start INTEGER,
  char_end INTEGER,
  entry_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scripture_text (
  ref TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'ESV',
  canonical TEXT,
  text TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ref, translation)
);

CREATE TABLE IF NOT EXISTS prayer_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  label TEXT,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES prayer_threads(id) ON DELETE SET NULL,
  thread_ref UUID,
  entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  movement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS altar_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  thread_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS altar_candidate_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  thread_id UUID,
  entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner, thread_id, entry_id)
);

CREATE TABLE IF NOT EXISTS item_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  item_id UUID,
  subject_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title TEXT,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ropes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  spiritual_item_id UUID
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime TEXT,
  bytes INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner, hash)
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  cursor JSONB NOT NULL DEFAULT '{}',
  total INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS processing_jobs_owner_kind_idx ON processing_jobs (owner, kind);

CREATE TABLE IF NOT EXISTS concordance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS concordance_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  entry_id UUID
);

CREATE TABLE IF NOT EXISTS concordance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concordance_shadow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  kind TEXT,
  noticed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, quote)
);

CREATE INDEX IF NOT EXISTS marks_owner_noticed_idx ON marks (owner, noticed_at DESC);

CREATE TABLE IF NOT EXISTS kept_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject_key TEXT NOT NULL,
  label TEXT NOT NULL,
  terms TEXT[] NOT NULL DEFAULT '{}',
  kind TEXT,
  kept_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner, subject_key)
);

CREATE TABLE IF NOT EXISTS welcome_drip_enrollments (
  owner TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'signup',
  status TEXT NOT NULL DEFAULT 'active',
  steps JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
