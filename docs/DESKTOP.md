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
- **Publish:** the workflow creates a release (tag `app-v0.1.<n>`) in the public
  repo **[phillipchan1/dayspring-releases](https://github.com/phillipchan1/dayspring-releases)**
  with the `.dmg`, the `.app.tar.gz`, and a generated `latest.json`. Source stays
  in this private repo; only binaries are public.
- **Auto-update:** on launch the app calls `initAutoUpdate()` ([src/lib/updater.ts](../src/lib/updater.ts)),
  which checks `releases/latest/download/latest.json`, and if a newer version
  exists, downloads + installs it and relaunches. It no-ops in the web build.

## First install

1. Open the latest release: <https://github.com/phillipchan1/dayspring-releases/releases/latest>
2. Download the `.dmg`, open it, drag **Dayspring** to Applications.
3. The build is **unsigned** (no Apple Developer cert), so Gatekeeper blocks the
   first launch. Either right-click the app → **Open** → **Open**, or run once:
   ```sh
   xattr -cr /Applications/Dayspring.app
   ```
4. After that, every push to `master` is picked up automatically — the app
   updates itself in the background and relaunches on the new version.

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
