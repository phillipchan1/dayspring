# Cloudflare Workers cutover (Dayspring marketing site)

This tree stays deployable on **Vercel** (`site/vercel.json`, `.vercelignore`,
`api/contact.ts`, platform defaults). Cloudflare Workers is additive. Do not
change DNS or promote a Worker to production from this PR.

The Vercel project is still named `dayspring-site`; its Root Directory is
`site/` of `phillipchan1/dayspring`. Production `usedayspring.app` is this
tree today.

## Build

From `site/`:

```bash
npm install
npm run build          # Astro static output → dist/
npx wrangler deploy --dry-run
```

Production deploy (after you are ready; **not** this PR):

```bash
npm run deploy:cf      # build + wrangler deploy
```

`src/worker.ts` handles `/api/*`. Everything else is `dist/` (`assets.directory`).

| Concern | Vercel today | Workers |
| --- | --- | --- |
| Pretty HTML (`/why` and `/why/`) | 200 both | `html_handling: auto-trailing-slash` |
| Unknown path | 404, not `index.html` | `not_found_handling: 404-page` |
| Headers | HSTS `max-age=63072000`, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=0, must-revalidate` (`vercel.json` has no `headers` block; these are platform defaults) | `public/_headers` (copied into `dist/`) |
| Path redirects / rewrites | none (`vercel.json` has neither) | `public/_redirects` (none) |
| Apex → www | 307 at the domain (`usedayspring.app` → `https://www.usedayspring.app/`) | attach both hostnames; 307 apex → www (below) |
| `POST /api/contact` | `api/contact.ts` (Vercel function) | `src/worker.ts` → same `POST()` |

## Worker secrets (`POST /api/contact`)

Same names as Vercel / `.env.example`. `api/contact.ts` is unchanged in
behavior and remains the Vercel rollback. The Worker reads these from
bindings via `bindContactEnv` (not `process.env`).

Set on the Worker (dashboard, or `npx wrangler secret put <NAME>`):

| Name | Required | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | one of Resend **or** GitHub | Preferred delivery |
| `GITHUB_TOKEN` | with `SUPPORT_REPO` | Issue fallback |
| `SUPPORT_REPO` | with `GITHUB_TOKEN` | e.g. `phillipchan1/dayspring` |
| `SUPPORT_LABEL` | no | Default `support` |
| `CONTACT_TO_EMAIL` | no | Default `hello@usedayspring.app` |
| `CONTACT_FROM_EMAIL` | no | Default `Dayspring <onboarding@resend.dev>` |
| `CONTACT_AUTOREPLY` | no | Set `true` only after the sending domain is verified |
| `TURNSTILE_SECRET_KEY` | no | Skipped when unset (same as Vercel) |

Local: copy the values into `.dev.vars` (gitignored). Unconfigured, the
endpoint still returns 503 and tells people to email hello@usedayspring.app.

`PUBLIC_TURNSTILE_SITE_KEY` is **not** a Worker secret. It is an Astro
`PUBLIC_` var, inlined into `/help/contact` at build time.

## Analytics (PostHog + Google Ads + Meta)

Already loaded from `src/layouts/Base.astro` (dayspring#131 / #135 / #136
and the Meta pixel). A Worker/`wrangler deploy` of `dist/` does not strip
them. They are **no-ops** unless these vars are present at `astro build`
(Astro inlines `import.meta.env.PUBLIC_*`). They are **not** Worker
runtime secrets. Set them on the Cloudflare **build** environment (and
keep them on the Vercel project):

| Name | Role |
| --- | --- |
| `PUBLIC_POSTHOG_KEY` | Project API key (same value as the app’s `VITE_POSTHOG_KEY`). Enables `$pageview`, `$pageleave`, session replay (inputs masked). Autocapture stays off. |
| `PUBLIC_POSTHOG_HOST` | Optional; default `https://us.i.posthog.com` |
| `PUBLIC_GOOGLE_TAG_ID` | `AW-XXXXXXXXX` — loads gtag.js (`dataLayer.push(arguments)`) |
| `PUBLIC_GADS_DOWNLOAD_SEND_TO` | `AW-…/label` for Mac download conversion |
| `PUBLIC_GADS_START_TRIAL_SEND_TO` | `AW-…/label` for `/start` |
| `PUBLIC_META_PIXEL_ID` | Meta Pixel ID — PageView on every page, StartTrial on `/start` |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget on `/help/contact` (not analytics) |

A Worker/`wrangler deploy` of `dist/` built **without** those vars will
ship the loader functions but will not inject `phc_…` or `AW-…`. Confirm
a production-shaped build with:

```bash
PUBLIC_POSTHOG_KEY=phc_… \
PUBLIC_GOOGLE_TAG_ID=AW-… \
npm run build
# dist/_astro/* should contain us.i.posthog.com / gtag/js?id=AW-…
```

## Domain attach (do not do this yet)

1. Deploy once to a `workers.dev` / preview URL: `npm run deploy:cf`.
2. Confirm routes on that URL (see the PR for the local `wrangler dev` list).
3. In the Cloudflare dashboard: Worker → **Domains & Routes** → **Add**
   `www.usedayspring.app`.
4. Add `usedayspring.app` (apex) on the same Worker.
5. Configure apex → `https://www.usedayspring.app/:path*` as a **307** (today’s
   Vercel status). Bulk Redirects or a tiny `run_worker_first` host check both
   work; `_redirects` cannot match on hostname.
6. Only then change DNS (apex + www) from Vercel to Cloudflare. This PR
   does not do that.

## Rollback

Vercel project, Git integration, `api/contact.ts`, `vercel.json`, and env
vars are unchanged.

1. Point DNS for `usedayspring.app` and `www.usedayspring.app` back to Vercel.
2. Do not delete `wrangler.jsonc`; leave the Worker idle.
3. Confirm `/`, `/help/contact`, and `POST /api/contact` on Vercel.
4. Apex should again 307 to `https://www.usedayspring.app/`.
