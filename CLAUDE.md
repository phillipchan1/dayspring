# Dayspring — Project Guide for Claude

## What Dayspring is

A multi-tenant subscription journal for practicing Christians ($7/mo, $64/yr, 14-day
trial) that shows users, over time, what God has been making of them. Web + macOS
(Tauri); iOS via Tauri (TestFlight — see `docs/IOS.md`).

## Product docs — read before product work

Before proposing features, writing user-facing copy, or scoping product work, read
[`docs/product/`](docs/product/README.md):

- **[VISION.md](docs/product/VISION.md)** — the promise, live non-goals, the bets we're making
- **[PRINCIPLES.md](docs/product/PRINCIPLES.md)** — 7 tie-breakers that settle feature arguments
- **[PERSONAS.md](docs/product/PERSONAS.md)** — who it's for (currently **hypotheses**, not findings)
- **[BRANDSCRIPT.md](docs/product/BRANDSCRIPT.md)** — how we talk; the words we never use

The team's Notion teamspace holds the Customer Feedback Backlog and Customer Discovery
Interviews databases — check both before proposing a feature or citing a persona as
validated. See [`docs/product/README.md` § External references (Notion)](docs/product/README.md)
for links; read via the Notion MCP connector when attached.

Non-negotiables that come up constantly: **light, not verdict** (never score someone's
spiritual life) · **never sermonize, never gamify** (no streaks, no badges, no guilt) ·
**grounded, or silent** (every claim traces to something the user actually wrote —
facts in code, model only selects, quotes verbatim) · **the editor is sacred** (nothing
adds latency or chrome to the writing surface).

`docs/archive/personal-ai-journal-requirements.md` is the superseded single-user
founding spec. **Do not build from it** — it predates multi-tenancy and payments.

## Release channels

| Channel | Branch | Who | Desktop build | Web |
|---|---|---|---|---|
| **Alpha** | `master` | Phil only | Every push, aarch64-only, fast | Vercel preview URL |
| **Stable / Production** | `stable` | Beta users | Mon + Thu schedule, universal binary | `dayspring-eosin.vercel.app` |

"Beta users", "production", and "stable" all mean the same thing: the `stable` branch.

## Shipping to beta / production

```bash
git checkout stable
git merge master        # or cherry-pick a specific fix
git push                # triggers the stable build automatically
git checkout master
```

The stable build takes ~20 min (universal binary). Beta users' apps auto-update silently via `releases/latest/download/latest.json`.

## Hotfix (urgent bug, skip the week of testing)

```bash
# Fix on master first, then port to stable
git checkout stable
git cherry-pick <sha>
git push
git checkout master
```

## How the two desktop channels work

- **Alpha** (`Dayspring-alpha.dmg`): polls `alpha-latest.json` committed to the root of `phillipchan1/dayspring-releases`. Phil must install this DMG once manually to join the alpha channel.
- **Stable** (`Dayspring.dmg`): polls `releases/latest/download/latest.json` via GitHub's `--latest` release mechanism. This is what beta users downloaded.

The endpoint URL is baked into each binary at build time — that's what separates the channels, not usernames.

## Workflows

- `.github/workflows/release.yml` — alpha, push-triggered on master, aarch64 only
- `.github/workflows/release-stable.yml` — stable, push-triggered on `stable` + Mon/Thu schedule, universal binary
- `.github/workflows/ios-release.yml` — iOS TestFlight, push-triggered on master (see `docs/IOS.md`)

## Vercel

Change production branch from `master` → `stable` in the Vercel dashboard (Settings → Git → Production Branch) so the web app matches the desktop channels.

## Marketing / help site

Lives in `site/` (Astro). Separate Vercel project (`dayspring-site`), Root
Directory `site`, domain `www.usedayspring.app`. Do not fold it into the app
SPA or the root `vercel.json`.

```bash
npm run dev:site    # http://localhost:4321
```
