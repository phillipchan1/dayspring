-- Optional app lock: a PIN (or passphrase) the user sets once that then guards
-- Dayspring on every device they own.
--
-- The verifier lives here — on the account — rather than on the device, because
-- "one PIN, set once, works on the Mac and the iPhone and the web" is the whole
-- requirement. A device-local secret would mean setting it separately on every
-- device, which is the thing users asked us not to make them do.
--
-- What is stored is a PBKDF2-SHA256 verifier (salt + iteration count + hash),
-- never the secret itself. NULL means the lock is off, which is the default and
-- what every existing row gets.
--
-- Deliberately its OWN column rather than a key inside `profiles.settings`.
-- Settings sync is a whole-object, last-writer-wins push with no per-field
-- timestamps (see src/hooks/useSettingsSync.ts) — a second device holding a
-- stale Settings blob would push the lock back off. A security control must not
-- be disableable by a race.
--
-- This is an access gate on the UI, NOT encryption: entries remain readable
-- server-side exactly as before (D-011 — no end-to-end encryption). It keeps
-- someone who picks up an unlocked laptop or phone out of the journal, and the
-- product copy must not claim more than that.

alter table public.profiles
  add column if not exists app_lock jsonb;
