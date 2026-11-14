# Vercel routes on the Worker (Neon)

The Worker serves these Vercel handlers **unchanged** (`api/**`). Each one runs inside a per-request bridge (`worker/src/vercel/`):

- `supabaseAdmin()` returns `pgrest.ts`, a supabase-js-shaped client over postgres.js / Hyperdrive. It covers `from().select/insert/upsert/update/delete`, the filters the code uses (including `or()` and `col->>key`), `order`, `range`, `single`, `count`, one-level embeds, and `rpc()`. Rows go through `row_to_json`, so jsonb comes back as objects and timestamps as ISO strings.
- `auth.getUser(token)` resolves a Better Auth bearer session. `auth.admin.getUserById` / `listUsers` read `"user"` and `account`. `user_metadata` is `{ name, full_name, avatar_url, picture }`, built from Better Auth `name` / `image`.
- `@vercel/functions` `waitUntil` maps to `ctx.waitUntil`. The route's own DB connection closes once those tasks settle.
- `kickWorker()` fetches this Worker's own `/api/cron/process-tick`, at `BETTER_AUTH_URL` with `CRON_SECRET`, never `APP_URL`.
- Worker string bindings are copied onto `process.env` for `api/_lib/env.ts`.

| Route | Gate |
|---|---|
| ask, transcribe-image, pages/interpret, keeping/read, reflections/generate, spiritual/notice, spiritual/scripture, onboarding/backfill, concordance/rebuild, cron synthesize / process-tick / echoes | AI Gateway ZDR only. Returns 501 unless `AI_GATEWAY_ZDR=on` and `AI_GATEWAY_API_KEY` are set. Never falls back to direct OpenAI. |
| transcribe | Calls OpenAI directly, as on Vercel (no ZDR speech-to-text; Tech Lead ruling Nov 13 2026). Needs the OpenAI key secret. |
| scripture-resolve, scripture-chapter, processing/enqueue | No model call. |
| cron remind, sync-resend, welcome-drip | **Off** until `WORKER_MAIL_CRONS=on`. Until then they return `{ ok: true, skipped }` and send nothing. |

## Mail crons: never on both platforms

Vercel's `remind`, `sync-resend` and `welcome-drip` crons keep sending until the switch. Turn them on for the Worker **in the same step** that removes them from Vercel (`vercel.json` crons, or the project's cron toggle):

1. Disable the Vercel crons.
2. Set `WORKER_MAIL_CRONS=on` on the Worker. Welcome-drip sends also need `WELCOME_DRIP_SENDS_ENABLED=true`, as on Vercel.

## Schema

`worker/schema/0005_vercel_port.sql` contains:

- `entries.body_hash`
- the Supabase unique indexes that the code's `onConflict` targets rely on
- the 7 plain RPCs
- the 2 pgvector RPCs, created only where the `vector` extension is available (Neon, not CI's postgres:17)

Embeddings stay TEXT and are cast to `vector` inside `match_entries*`. Apply 0005 at the switch, after the backup. `migrate-neon.mjs --apply` applies numbered files.
