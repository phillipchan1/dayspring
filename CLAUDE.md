# Dayspring — Project Guide for Claude

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

## Vercel

Change production branch from `master` → `stable` in the Vercel dashboard (Settings → Git → Production Branch) so the web app matches the desktop channels.
