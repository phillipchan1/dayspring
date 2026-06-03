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

  // Fallback: tauri.conf.json (always 0.1.0 in repo, correct during Tauri CI)
  const tauriConf = JSON.parse(
    readFileSync(fileURLToPath(new URL('./src-tauri/tauri.conf.json', import.meta.url)), 'utf8'),
  ) as { version: string }
  return tauriConf.version
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
    port: 5180,
    strictPort: true,
  },
  test: {
    // Pure logic (markdown parsing, formatting, slash detection) needs no DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
