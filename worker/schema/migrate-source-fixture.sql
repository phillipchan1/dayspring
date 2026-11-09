-- Supabase-shaped source for scripts/migrate-neon.mjs --ci. Local only.
-- Columns match prod information_schema (OSIS scripture_refs, no canonical;
-- concordance.canonical not term; profiles.acked_processing_completion text).
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  identity_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  has_seen_welcome BOOLEAN NOT NULL DEFAULT FALSE,
  plan TEXT,
  plan_source TEXT,
  acked_processing_completion TEXT,
  scripture_scan_watermark INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body_markdown TEXT NOT NULL DEFAULT '',
  title TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'native',
  tags TEXT[] NOT NULL DEFAULT '{}',
  circumstances JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  content_markdown TEXT,
  structured_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.spiritual_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  entry_id UUID REFERENCES public.entries(id),
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subject_tags JSONB
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  entry_id UUID REFERENCES public.entries(id),
  content TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  fired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.echo_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  entry_id UUID,
  text TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.echo_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  entry_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resurface_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scripture_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  entry_id UUID NOT NULL REFERENCES public.entries(id),
  book_osis TEXT NOT NULL,
  book_name TEXT NOT NULL,
  book_order INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER,
  verse_end INTEGER,
  osis_ref TEXT NOT NULL,
  entry_created_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scripture_text (
  ref TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'ESV',
  canonical TEXT NOT NULL,
  text TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ref, translation)
);

CREATE TABLE IF NOT EXISTS public.prayer_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  carries TEXT[] NOT NULL DEFAULT '{}',
  planted_at TIMESTAMPTZ NOT NULL,
  last_touch_at TIMESTAMPTZ NOT NULL,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  thread_id UUID REFERENCES public.prayer_threads(id),
  source_entry_id UUID REFERENCES public.entries(id),
  movement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.altar_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  thread_id UUID,
  source_entry_id UUID,
  entry_date TEXT NOT NULL,
  quote TEXT NOT NULL,
  one_line_reason TEXT NOT NULL,
  gentle_question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.altar_candidate_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  thread_id UUID,
  entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.item_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  item_id UUID NOT NULL REFERENCES public.spiritual_items(id),
  subject_id UUID NOT NULL REFERENCES public.prayer_threads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ropes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'derived',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.thread_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id),
  entry_id UUID REFERENCES public.entries(id),
  register TEXT NOT NULL DEFAULT 'neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  hash TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime TEXT,
  bytes INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  cursor JSONB NOT NULL DEFAULT '{}',
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.concordance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  kind TEXT NOT NULL,
  canonical TEXT NOT NULL,
  surface_forms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'suggested',
  source TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.concordance_occurrences (
  concordance_id UUID NOT NULL REFERENCES public.concordance(id),
  entry_id UUID NOT NULL REFERENCES public.entries(id),
  owner UUID NOT NULL REFERENCES auth.users(id),
  entry_created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (concordance_id, entry_id)
);

CREATE TABLE IF NOT EXISTS public.concordance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  kind TEXT NOT NULL,
  canonical TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.concordance_shadow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  kind TEXT NOT NULL,
  canonical TEXT NOT NULL,
  surface_forms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'suggested',
  source TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  entry_id UUID NOT NULL REFERENCES public.entries(id),
  quote TEXT NOT NULL,
  char_start INTEGER,
  noticed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kept_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  subject_key TEXT NOT NULL,
  label TEXT NOT NULL,
  terms TEXT[] NOT NULL DEFAULT '{}',
  kept_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.welcome_drip_enrollments (
  owner UUID PRIMARY KEY REFERENCES auth.users(id),
  enrolled_at DATE NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  steps JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
