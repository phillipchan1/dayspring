# Production Worker environment (`--env production`)

Repo-only. Do **not** run `wrangler hyperdrive create`, `wrangler deploy`,
DNS, or Neon provisioning from this branch. The id in `wrangler.jsonc` stays
`HYPERDRIVE_ID_PLACEHOLDER` until an operator fills it in outside this PR.

The Worker name is **`dayspring`**. Preview stays `dayspring-preview` on
workers.dev with a direct Neon `DATABASE_URL`. The Vite client stays flag-off
(Vercel + Supabase).

Assumed spend: **Workers Paid** (Hyperdrive). No other paid Cloudflare or Neon
tier.

## Names only — secrets, vars, bindings

Do not put values in this file. Do not commit values in `wrangler.jsonc` `vars`.

### Bindings

| Name | Kind |
|---|---|
| `HYPERDRIVE` | Hyperdrive binding (prod). Placeholder id until create. |
| `ASSETS` | Static assets from `dist/` (wrangler `assets`, not operator-set). |

### Vars (`wrangler.jsonc` `env.production.vars` or dashboard vars)

| Name |
|---|
| `OPENAI_MODEL` |
| `RESEND_FROM` |
| `WELCOME_DRIP_SENDS_ENABLED` |
| `BETTER_AUTH_URL` |
| `APPLE_CLIENT_ID` |
| `APPLE_APP_BUNDLE_IDENTIFIER` |
| `GOOGLE_CLIENT_ID` |
| `AI_GATEWAY_ZDR` |
| `AI_GATEWAY_ZDR_PROVIDERS` |
| `OPENAI_VISION_MODEL` |
| `OPENAI_EMBED_MODEL` |
| `APPLE_BUNDLE_ID` |
| `APPLE_APP_APPLE_ID` |
| `APP_URL` |
| `ONBOARDING_REQUIRE_CARD` |
| `VITE_POSTHOG_KEY` |
| `VITE_POSTHOG_HOST` |
| `META_PIXEL_ID` |

`BETTER_AUTH_URL` is required at runtime outside `ENVIRONMENT=local`. Leave it
**unset** in committed production vars until the public origin exists. It must
not be `localhost` or `*.workers.dev`.

`AI_GATEWAY_ZDR` unset (or anything other than `on` / `true`) leaves Worker
AI routes 501. Do not set `ENVIRONMENT` in production. The Worker does not
read `OPENAI_API_KEY`.

### Secrets (`wrangler secret put --env production`)

| Name | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | Better Auth |
| `APPLE_CLIENT_SECRET` | Sign in with Apple (JWT) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `CRON_SECRET` | Cron routes |
| `RESEND_API_KEY` | OTP + drip |
| `ESV_API_KEY` | Scripture routes |
| `AI_GATEWAY_API_KEY` | Worker AI (no Vercel OIDC). Needed if `AI_GATEWAY_ZDR` is on |
| `DATABASE_URL` | Fallback only. Prod uses `HYPERDRIVE`. Preview / `wrangler dev` without Hyperdrive still need this. |
| `STRIPE_SECRET_KEY` | Stripe **test** mode (`sk_test_…`). Checkout, portal, webhooks |
| `STRIPE_WEBHOOK_SECRET` | Stripe **test** webhook signing secret (`whsec_…`) |
| `STRIPE_ANNUAL_PRICE_ID` | Stripe test-mode annual price |
| `STRIPE_MONTHLY_PRICE_ID` | Stripe test-mode monthly price |
| `APPLE_ISSUER_ID` | App Store Connect IAP key issuer |
| `APPLE_KEY_ID` | App Store Connect IAP key id |
| `APPLE_PRIVATE_KEY` | `.p8` contents (`\n` or real newlines). Sandbox |
| `META_CAPI_ACCESS_TOKEN` | Optional. Growth ledger (Purchase/Cancel/StartTrial) |

Never list those secret names under `vars`. `npm run check:worker` fails if
production vars contain `localhost`, a `workers.dev` `BETTER_AUTH_URL`, or a
secret key.

## Hyperdrive (operator, later)

Hyperdrive is **not** inherited. `env.production` declares the binding;
`env.preview` must keep `"hyperdrive": []`.

Neon connection for Hyperdrive:

- **Direct**, not pooled. In the Neon console, Connection pooling **off**.
  The hostname must **not** contain `-pooler`. Hyperdrive pools on the
  Cloudflare side; a Neon pooler URL is double pooling.
- **`sslmode=require`** on the origin (Hyperdrive → Neon). Set it in the
  JSON `mtls.sslmode` field. `require` is Hyperdrive’s default TLS mode
  (WebPKI); `verify-full` needs an uploaded CA and is not used here.
- Worker-side `env.HYPERDRIVE.connectionString` is `.hyperdrive.local` with
  TLS off; that is expected. Direct `DATABASE_URL` (preview / local) still
  gets `sslmode=verify-full` in `worker/src/db.ts`.

**Do not use `wrangler hyperdrive create`.** Wrangler only accepts
`--origin-password` or `--connection-string`, both of which put the Neon
password on argv (`"$PGPASSWORD"` still expands). There is no wrangler
flag that reads the password from a file.

Create Hyperdrive with the same REST call wrangler uses
(`POST /accounts/{account_id}/hyperdrive/configs` in
`packages/wrangler/src/hyperdrive/client.ts`). curl `--data @file` and
`--header @file` send the body and auth header from 0600 files; neither
value appears in argv. This is curl’s documented `@file` form, not a
live create from this PR.

```bash
# ~/.config/dayspring/hyperdrive-create.json  (chmod 600)
# Direct host — no "-pooler". Replace host / database / user from Neon.
# origin.password is the Neon role password; it lives only in this file.
# {
#   "name": "dayspring",
#   "origin": {
#     "scheme": "postgresql",
#     "host": "ep-XXXX.us-east-1.aws.neon.tech",
#     "port": 5432,
#     "database": "neondb",
#     "user": "neondb_owner",
#     "password": "<neon-role-password>"
#   },
#   "mtls": { "sslmode": "require" }
# }
#
# ~/.config/dayspring/cf-auth.header  (chmod 600, one line):
# Authorization: Bearer <CLOUDFLARE_API_TOKEN with Hyperdrive Write>
#
# Do not run this from CI or from this PR. Do not cat the JSON or header.

curl -sS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/hyperdrive/configs" \
  -H 'Content-Type: application/json' \
  -H @"${HOME}/.config/dayspring/cf-auth.header" \
  --data @"${HOME}/.config/dayspring/hyperdrive-create.json"
```

Read `result.id` from the JSON response (the API never returns
`origin.password`). Put that id in `wrangler.jsonc`
`env.production.hyperdrive[0].id`, replacing `HYPERDRIVE_ID_PLACEHOLDER`.
Leave `env.preview.hyperdrive` empty.

For **psql** (schema apply), pass the Postgres password only through
`PGPASSWORD` from a **0600** file or `~/.pgpass`. Never put it on the
psql command line.

```bash
umask 077
chmod 600 ~/.config/dayspring/neon.pw
export PGPASSWORD="$(cat ~/.config/dayspring/neon.pw)"
psql "host=ep-XXXX.us-east-1.aws.neon.tech port=5432 dbname=neondb user=neondb_owner sslmode=require" \
  -f worker/schema/0001_init.sql
unset PGPASSWORD
```

`.pgpass` alternative (also 0600): `hostname:5432:database:username:password`,
then `export PGPASSWORD="$(awk -F: -v h="$NEON_HOST" '$1==h {print $5; exit}' ~/.pgpass)"`.

Then set production secrets (names above) with
`npx wrangler secret put <NAME> --env production` and set `BETTER_AUTH_URL`
to the public origin (not workers.dev). Do not deploy from this PR.

## Proof (no live deploy)

```bash
npm run typecheck
npm test
npm run check:worker
npm run check:isolation-mutation
npx wrangler deploy --env preview --dry-run
npx wrangler deploy --env production --dry-run
```
