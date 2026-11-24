-- Better Auth rate-limit rows when rateLimit.storage = 'database'.
-- Per-isolate memory is not shared across Cloudflare Workers; this table is.
-- Also used for the per-email OTP send cap and POST /api/auth/native/claim.
CREATE TABLE IF NOT EXISTS rate_limit (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  last_request BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_key_idx ON rate_limit (key);
