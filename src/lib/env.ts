import { isTauri } from './platform'

// Centralised, typed access to environment configuration.
// Reads names only — actual secret values live in .env.local (gitignored).

/** Production Vercel origin — also hosts /api/* for the desktop app. */
const DEFAULT_API_BASE = 'https://dayspring-eosin.vercel.app'

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  /** Absolute API origin for Tauri; empty on web → same-origin relative /api paths. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? (isTauri() ? DEFAULT_API_BASE : ''),
  /** PostHog project API key. Unset → analytics transport stays a console-only no-op. */
  posthogKey: import.meta.env.VITE_POSTHOG_KEY ?? '',
  posthogHost: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
}

/** True once the Supabase keys are present. Lets the UI render a shell without keys. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
