/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// Resolve the real app version. Priority:
//   1. public/changelog.json — written by scripts/assemble-changelog.mjs
//      BEFORE this Vite build runs (both Tauri CI and Vercel buildCommand).
//      Its first entry is always the latest release, which is the correct version.
//   2. src-tauri/tauri.conf.json — patched in-place by CI but never committed,
//      so it reads 0.1.0 in the repo. Use only as a local-dev fallback.
function resolveAppVersion(): string {
  try {
    const changelog = JSON.parse(
      readFileSync(fileURLToPath(new URL('./public/changelog.json', import.meta.url)), 'utf8'),
    ) as { versions?: { version: string }[] }
    const latest = changelog.versions?.[0]?.version
    if (latest) return latest
  } catch {
    // No changelog.json yet (local dev without running the script) — fall through.
  }
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
