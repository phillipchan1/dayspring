import { isTauri } from './platform'

// Centralised, typed access to environment configuration.
// Reads names only — actual secret values live in .env.local (gitignored).

/** Production Vercel origin — also hosts /api/* for the desktop app. */
const DEFAULT_API_BASE = 'https://dayspring-eosin.vercel.app'

/**
 * One VITE_* value, from wherever this module is running.
 *
 * Vite substitutes `import.meta.env` at build time, so the browser and the
 * Tauri webview take that branch and nothing changes for them. Under plain Node
 * — `tsx scripts/…`, where the diagnostic scripts import app modules so an
 * audit measures the real code rather than a copy of it — `import.meta.env` is
 * undefined and reading through it throws at module load, taking down every
 * importer with it. Fall back to `process.env`, which is where a script's .env
 * has already been loaded.
 */
function viteEnv(key: string): string | undefined {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  if (meta) return meta[key]
  return typeof process !== 'undefined' ? process.env?.[key] : undefined
}

export const env = {
  supabaseUrl: viteEnv('VITE_SUPABASE_URL') ?? '',
  supabaseAnonKey: viteEnv('VITE_SUPABASE_ANON_KEY') ?? '',
  /** Absolute API origin for Tauri; empty on web → same-origin relative /api paths. */
  apiBaseUrl: viteEnv('VITE_API_BASE_URL') ?? (isTauri() ? DEFAULT_API_BASE : ''),
  /** PostHog project API key. Unset → analytics transport stays a console-only no-op. */
  posthogKey: viteEnv('VITE_POSTHOG_KEY') ?? '',
  posthogHost: viteEnv('VITE_POSTHOG_HOST') ?? 'https://us.i.posthog.com',
}

/** True once the Supabase keys are present. Lets the UI render a shell without keys. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
