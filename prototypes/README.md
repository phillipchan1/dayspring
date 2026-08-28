# Dayspring prototypes

Self-guided click-through mockups for beta feedback. Not part of the live app.

**Live:** [prototypes.usedayspring.app](https://prototypes.usedayspring.app) ([dayspring-prototypes.vercel.app](https://dayspring-prototypes.vercel.app) until DNS is set)

| Prototype | Path | Short subdomain |
|-----------|------|-----------------|
| Scripture | [/scripture/#intro](https://prototypes.usedayspring.app/scripture/#intro) | [scripture.prototypes.usedayspring.app](https://scripture.prototypes.usedayspring.app/#intro) |
| Recall | [/recall/#strand](https://prototypes.usedayspring.app/recall/#strand) | [recall.prototypes.usedayspring.app](https://recall.prototypes.usedayspring.app/#strand) (screen-share; unlisted on hub) |
| Visitation | [/visitation/#arrives](https://prototypes.usedayspring.app/visitation/#arrives) | [visitation.prototypes.usedayspring.app](https://visitation.prototypes.usedayspring.app/#arrives) (screen-share; unlisted on hub) |

## New prototype

```bash
cd prototypes
npm run prototype:new altar
cd altar && npm install && npm run dev
```

Opens at `http://localhost:5173/altar/#intro`. Register in [`prototypes.json`](./prototypes.json) (the script adds a draft entry).

## Build all (what Vercel runs)

```bash
cd prototypes
npm install
npm run build
```

Output: `prototypes/dist/` — one folder per slug plus a hub `index.html`.

## Deploy

Single Vercel project **`dayspring-prototypes`**, root directory **`prototypes`**.

Pushes that **only** touch `prototypes/` skip the main app builds (GitHub Actions `paths-ignore` + Vercel `ignoreCommand` on both projects).

Env vars (production): `RESEND_API_KEY`, optional `FEEDBACK_TO` / `FEEDBACK_FROM`. See [`.env.example`](./.env.example).

DNS on `usedayspring.app` (Porkbun — add these **A** records pointing to `76.76.21.21`):

| Host | Purpose |
|------|---------|
| `prototypes` | Hub + path URLs |
| `scripture.prototypes` | Short link for scripture |
| `recall.prototypes` | Short link for recall |
| `visitation.prototypes` | Short link for visitation |

For future prototypes, add `<slug>.prototypes` the same way, or a wildcard `*.prototypes` if Porkbun supports it.

Until DNS propagates, use [dayspring-prototypes.vercel.app](https://dayspring-prototypes.vercel.app).

## Layout

```
prototypes/
  prototypes.json       # manifest — slug, title, listed, hasFeedback
  scripts/build-all.mjs
  _shared/              # feedback delivery + dev middleware
  _template/            # copy for npm run prototype:new
  api/feedback.ts       # shared POST endpoint
  scripture/
  recall/
  visitation/
```

Each prototype is its own Vite app with `base: '/<slug>/'`. Hash routing (`#intro`) keeps hosting simple.

## Local feedback email

Copy `.env.example` → `.env.local` in `prototypes/` or the prototype folder. Vite dev loads `RESEND_API_KEY` for `/api/feedback`.
