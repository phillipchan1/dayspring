-- Better Auth rate-limit rows when rateLimit.storage = 'database'.
-- Per-isolate memory is not shared across Cloudflare Workers; this table is.
-- Also used for POST /api/auth/native/claim. The per-email OTP send cap lives
-- in otp_send_limit (0010) so Better Auth's cleanup cannot wipe a 10-minute window.
-- UNIQUE (key) already indexes key; do not add a second rate_limit_key_idx.
CREATE TABLE IF NOT EXISTS rate_limit (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  last_request BIGINT NOT NULL
);
