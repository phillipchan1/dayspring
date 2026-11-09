-- Supabase-shaped source for scripts/migrate-neon.mjs --ci. Local only.
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
  tags TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.echo_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  entry_id UUID,
  text TEXT NOT NULL,
  entry_date TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id),
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'derived',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
