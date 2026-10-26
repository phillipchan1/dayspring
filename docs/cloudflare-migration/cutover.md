# Dayspring Cloudflare cutover (draft only)

Do **not** deploy, change DNS, touch prod Supabase, StoreKit/billing webhooks,
OpenAI/gateway config, or App Store submissions from this branch. Live Dayspring
stays on Vercel + Supabase until Phil signs off.

The shipped web and iOS apps keep using Supabase/Vercel unless
`VITE_BACKEND=workers` or a `*.workers.dev` `VITE_API_BASE_URL` is set at
**build time**. Today's Vercel and TestFlight builds do neither.

Pattern matches [phillipchan1/zeroed#11–#13](https://github.com/phillipchan1/zeroed/pulls?q=is%3Apr+11+12+13).

## What this PR adds

| Piece | Today | This PR (inert) | After a future cutover |
|---|---|---|---|
| SPA | Vercel Vite | Unchanged | Optional Workers Static Assets |
| `/api/*` (AI, drip, crons) | Vercel serverless | Hono Worker implements the same paths; unused unless the flag is on | Point `VITE_API_BASE_URL` at the Worker |
| Auth | Supabase Google / Apple / email | Better Auth on `/api/auth` (email OTP + bearer). Client still uses Supabase Auth while the flag is off | Flip the flag; map `auth.users` → `"user"` |
| Journal / RLS tables | Supabase PostgREST + RLS | Worker `store.ts` + `/api/data/*` with per-owner SQL. Client still uses `supabase.from()` while the flag is off | Route data through the Worker |
| Storage | Supabase bucket `attachments` | Documented; R2 not wired | R2 + signed URLs |
| Realtime | `entries`, `processing_jobs` | Unchanged | Poll / SSE |
| Billing webhooks | Vercel | Worker returns 501 on purpose | Keep Vercel until ASC/Stripe URLs are moved |

## Secrets and bindings (workers.dev preview only)

None of these belong in the Vite bundle. Do not put localhost in `wrangler.jsonc`
`vars` — those ship if someone later deploys.

| Name | Kind | Required | Cost |
|---|---|---|---|
| `HYPERDRIVE` | Worker binding | Prod-shaped deploys | **Workers Paid** ($5/mo) — Hyperdrive is not on Free. Preview can skip it and use `DATABASE_URL`. |
| `DATABASE_URL` | secret | Yes for `wrangler dev` / preview without Hyperdrive | Neon Free (0.5 GB, autosuspend). First query after suspend is ~300–500 ms. |
| `BETTER_AUTH_SECRET` | secret | Yes (32+ random bytes) | Free |
| `BETTER_AUTH_URL` | Worker var | Preview is committed as `https://dayspring-preview.nq-morning-briefing.workers.dev`. Unset throws outside local. | Free |
| `ENVIRONMENT` | `.dev.vars` only | `local` allows a localhost auth fallback | Never set in preview/prod |
| `CRON_SECRET` | secret | Cron routes | Free |
| `OPENAI_API_KEY` | secret | AI routes; omit → those routes 501 | Existing key; **do not change gateway config** |
| `OPENAI_MODEL` | var | Default `gpt-5.4-nano` (Worker only; Vercel unchanged) | — |
| `RESEND_API_KEY` / `RESEND_FROM` | secret / var | OTP + drip sends | Resend free tier |
| `WELCOME_DRIP_SENDS_ENABLED` | var | Must stay `false` until an explicit enable | — |
| `ESV_API_KEY` | secret | Scripture routes | Existing |

`BETTER_AUTH_URL` fail-closed rules are the Zeroed #12/#13 ones: no substring
`localhost` match on the DB URL; loopback includes `[::1]` and `127.0.0.0/8`;
misconfig is JSON 500 and echoes ACAO+credentials only for loopback Origins.

## Free-tier costs and CPU

This PR targets **Workers Free** + **Neon Free**. Things that cost money:

| Item | Why it would cost |
|---|---|
| **Hyperdrive** | Requires Workers Paid ($5/mo). Preview command below uses a direct Neon URL. |
| **Workers Paid** | Free is **10 ms CPU / request**. The routes in inventory §6 marked **Will exceed 10 ms CPU** (`ask`, `transcribe*`, `keeping/read`, `pages/interpret`, `synthesize`, `process-tick`, `onboarding/backfill`, echo/altar embed) will 1101/1102 on Free the first time they run a real model or drain a job queue. I/O wait does not count; JSON + pgvector + prompt assembly does. |
| **Workers bundle** | Free compressed limit is **3 MB**. Paid is 10 MB. Better Auth + `pg` + Hono is the size risk — check `wrangler deploy` output before relying on Free. |
| **R2** | 10 GB free. Not provisioned here. |
| **Neon** | Free 0.5 GB. Synthetic seed only. A prod dump would need a size check first. |
| **Cron every minute** | Free allows cron; `process-tick` is 1,440 requests/day of the 100,000 Free cap, plus whatever work it does. |

Do not enable the Worker crons against production data.

## Preview on workers.dev (do not run from CI)

```bash
# 1. Neon Free project, empty. Apply schema (no prod dump):
psql "$DATABASE_URL" -f worker/schema/0001_init.sql

# 2. Synthetic users only:
DATABASE_URL="$DATABASE_URL" node scripts/seed-synthetic.mjs

# 3. Local secrets (never commit):
cp .dev.vars.example .dev.vars
# Set DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:8787, ENVIRONMENT=local

# 4. Local Worker (no deploy):
npm run cf:dev
# GET http://localhost:8787/api/health

# 5. Preview deploy to workers.dev only — not production, no custom domain:
npx wrangler deploy --env preview --dry-run   # must be clean (no Hyperdrive)
npx wrangler deploy --env preview
# then:
#   npx wrangler secret put DATABASE_URL --env preview
#   npx wrangler secret put BETTER_AUTH_SECRET --env preview
#   npx wrangler secret put CRON_SECRET --env preview
# BETTER_AUTH_URL is a committed preview var:
#   https://dayspring-preview.nq-morning-briefing.workers.dev
```

`wrangler.jsonc` `env.preview` sets `workers_dev: true` and does **not** declare
routes, a custom domain, or Hyperdrive (Hyperdrive is not inherited; preview
uses `DATABASE_URL`). `wrangler deploy --env preview` may warn that top-level
`HYPERDRIVE` is missing on preview — that is expected; do not add a placeholder
id (error 10157).

## iOS

`.github/workflows/ios-release.yml` reads `VITE_API_BASE_URL` from
`vars.VITE_API_BASE_URL`. If the variable is empty, the IPA keeps
`https://dayspring-eosin.vercel.app` (production unchanged).

Target signing (documented, not forced in this PR — today's workflow still
uses `tauri ios build`):

- Automatic signing with an App Store Connect API key
- `xcodebuild … -allowProvisioningUpdates -authenticationKeyPath -authenticationKeyID -authenticationKeyIssuerID`

Required secrets for that target:

| Secret | Role |
|---|---|
| `APPSTORE_KEY_ID` (or `ASC_API_KEY_ID`) | ASC API Key ID |
| `APPSTORE_ISSUER_ID` (or `ASC_API_ISSUER_ID`) | ASC Issuer ID |
| `APPSTORE_PRIVATE_KEY` (or `ASC_API_KEY_P8`) | base64 or PEM of `AuthKey_*.p8` |
| `APPLE_TEAM_ID` | `4629AQ24Z2` |

Optional fallback (leave unset for automatic signing): `IOS_CERTIFICATE`,
`IOS_CERTIFICATE_PASSWORD`, `IOS_MOBILE_PROVISION`. Never point these at the
desktop Developer ID cert.

`VITE_SUPABASE_*` stay baked so journal sync keeps working until the data
client is flipped. Setting the API variable to a workers.dev origin only moves
`/api/*`.

## Proof

```bash
npm run typecheck
npm test
npm run check:worker
npm run check:isolation-mutation
```

Isolation applies `worker/schema/0001_init.sql` onto PGlite, seeds two users,
and asserts user A cannot read or write user B on every store path. The mutation
script then deletes each `owner = ${store.ownerId}` filter and expects a failure.
