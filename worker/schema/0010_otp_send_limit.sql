-- Per-email OTP send cap (5 / 10 minutes). Dedicated so Better Auth's
-- rate_limit cleanup — which deletes rows older than its longest rule window
-- (the email-OTP IP rule is 60s) — cannot reset the cap about every minute.
CREATE TABLE IF NOT EXISTS otp_send_limit (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL
);

-- Older 0009 drafts also created rate_limit_key_idx next to UNIQUE (key).
DROP INDEX IF EXISTS rate_limit_key_idx;