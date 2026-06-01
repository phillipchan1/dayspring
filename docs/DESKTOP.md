# Desktop app (Tauri) + auto-update

The web app is wrapped as a native macOS app with [Tauri v2](https://v2.tauri.app/).
Every push to `master` builds a signed Apple-Silicon build in CI and publishes it
to a **public** releases repo, and installed apps auto-update from there.

## How it works

- **Build trigger:** `.github/workflows/release.yml` runs on every push to `master`.
- **Versioning:** each run sets the version to `0.1.<github run number>` so it
  always increments — the updater compares semver to decide whether to update.
- **Build:** `tauri-apps/tauri-action` builds `aarch64-apple-darwin` and signs the
  update bundle with the Tauri updater key.
- **Release notes:** before publishing, the workflow diffs the commits in this
  push (`github.event.before..HEAD`) and runs them through
  [scripts/release-notes.mjs](../scripts/release-notes.mjs), which asks OpenAI to
  rewrite them as a short, user-facing changelog. This is **best-effort**: if
  `OPENAI_API_KEY` is unset or the API errors, it falls back to a cleaned commit
  list, so a notes failure never blocks a release. The result fills both the
  `notes` field of `latest.json` and the GitHub release body.
- **Publish:** the workflow creates a release (tag `app-v0.1.<n>`) in the public
  repo **[phillipchan1/dayspring-releases](https://github.com/phillipchan1/dayspring-releases)**
  with the `.dmg`, the `.app.tar.gz`, and a generated `latest.json`. Source stays
  in this private repo; only binaries are public.
- **Auto-update:** on launch the app polls `releases/latest/download/latest.json`
  via the shared update store ([src/lib/appUpdate.ts](../src/lib/appUpdate.ts)),
  and if a newer version exists, downloads + installs it and surfaces a Restart
  prompt. The updater's `body` (the `latest.json` `notes`) is shown as a "What's
  new" disclosure in both the bottom-left toast and Settings → About. No-ops in
  the web build.

## First install

1. Open the latest release: <https://github.com/phillipchan1/dayspring-releases/releases/latest>
2. Download the `.dmg`, open it, drag **Dayspring** to Applications.
3. The build is **unsigned / not notarized** (no Apple Developer cert), so on
   first launch macOS says *"Dayspring is damaged and can't be opened."* That's
   Gatekeeper reacting to the quarantine flag — the app is fine. Right-click →
   Open does **not** clear this one; instead strip the quarantine flag once:
   ```sh
   xattr -cr /Applications/Dayspring.app
   ```
   Then open it normally. (Do this on the copy in /Applications, not on the
   read-only `.dmg`.)
4. After that, every push to `master` is picked up automatically — the app
   updates itself in the background and relaunches on the new version. Auto-
   updates are **not** re-quarantined, so you only ever run `xattr` once.

## Local development

```sh
npm run tauri:dev     # run the desktop app against the Vite dev server
npm run tauri:build   # build a local .dmg (requires Rust toolchain)
```
Local builds require Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.
CI does not need Rust on your machine.

## Secrets & keys (already configured)

GitHub Actions secrets on the private repo:

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update bundles (verified by the embedded pubkey) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase for the key (empty) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Frontend build-time env |
| `RELEASES_TOKEN` | Lets the build publish releases to the public repo |
| `OPENAI_API_KEY` | _(optional)_ LLM-polished release notes; falls back to a cleaned commit list if unset. Set once with `gh secret set OPENAI_API_KEY`. Override the model with the `OPENAI_MODEL` env (default `gpt-5.4-nano`). |

### ⚠️ Back up the updater private key

The private signing key lives at `src-tauri/dayspring-updater.key` (gitignored).
**If you lose it, you can never ship another update** that existing installs will
accept — they'd have to be reinstalled manually. Copy it somewhere safe (password
manager / encrypted backup). The matching public key is embedded in
`src-tauri/tauri.conf.json`.

### Hardening `RELEASES_TOKEN` (optional)

It's currently seeded with your `gh` CLI token (broad scope). For least privilege,
replace it with a **fine-grained PAT** scoped to only `dayspring-releases` with
**Contents: Read and write**, then:
```sh
gh secret set RELEASES_TOKEN --body "<new-token>"
```
