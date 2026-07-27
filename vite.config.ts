/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Resolve the real app version. Priority:
//   1. public/changelog.json — written by scripts/assemble-changelog.mjs.
//      In CI/Vercel production the buildCommand runs the script before this.
//      In local dev (npm run dev OR vercel dev) the file may not exist yet —
//      we generate it on-the-fly so the correct version shows everywhere.
//   2. src-tauri/tauri.conf.json — patched in-place by CI but never committed,
//      so it reads 0.1.0 in the repo. Used only as an offline fallback.
function resolveAppVersion(): string {
  const changelogPath = fileURLToPath(new URL('./public/changelog.json', import.meta.url))

  // Auto-generate in dev when the file doesn't exist yet.
  // CI/Vercel buildCommand already ran the script, so existsSync is true there
  // and we skip the execSync entirely.
  if (!existsSync(changelogPath)) {
    try {
      execSync('node scripts/assemble-changelog.mjs', { stdio: 'pipe' })
    } catch {
      // best-effort — offline or GitHub rate-limited; fall through to tauri.conf
    }
  }

  try {
    const changelog = JSON.parse(readFileSync(changelogPath, 'utf8')) as {
      versions?: { version: string }[]
    }
    const latest = changelog.versions?.[0]?.version
    if (latest) return latest
  } catch {
    // file still missing after failed generation — fall through
  }

  // Fallback: package.json — single source of truth for major.minor.
  // (tauri.conf.json is always 1.0.0 in the repo; CI patches it at build time
  // so it would show a stale version in local dev and Vercel preview builds.)
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
  ) as { version: string }
  return pkg.version
}

const APP_VERSION = resolveAppVersion()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: process.env.TAURI_DEV_HOST || '0.0.0.0',
    port: 5180,
    strictPort: true,
    watch: {
      // Exclude large/irrelevant trees that aren't frontend source.
      ignored: [
        `${process.cwd()}/src-tauri/**`,  // Rust build artifacts + iOS/Xcode
        `${process.cwd()}/dist/**`,        // vite build output
        `${process.cwd()}/scripts/**`,     // server-side scripts (not bundled)
        `${process.cwd()}/.git/**`,
      ],
    },
  },
  test: {
    // Pure logic (markdown parsing, formatting, slash detection) needs no DOM.
    environment: 'node',
    // api/ too: the server-side grouping logic (declared threads) is pure and worth
    // pinning down — a silent regression there is what made the Altar unreadable.
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
