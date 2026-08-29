# site/ — stable-only stub

There is no marketing site on `stable`. This directory exists only so the
`dayspring-site` Vercel project (Root Directory = `site`) finds its root and can
run the Ignored Build Step. Without it, Vercel fails the deploy with
`Root Directory "site" does not exist` before the ignore command ever runs.

`vercel-ignore.sh` here always exits 0, so a `dayspring-site` deploy on `stable`
is skipped rather than built. Nothing in this directory is meant to build: no
Astro app, no `package.json`.

The real Astro site lives on `master` under `site/`. When master merges into
stable, `vercel-ignore.sh`, `vercel.json`, and this file conflict add/add against
master's real ones — take master's side for all three. `dayspring-site` then
builds from stable as normal.
