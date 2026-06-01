import { isTauri } from './platform'

// Centralised, typed access to environment configuration.
// Reads names only — actual secret values live in .env.local (gitignored).

/** Production web origin — also hosts /api/* for the desktop app. */
const DEFAULT_API_BASE = 'https://dayspring.app'

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  /** Absolute API origin for Tauri; empty on web → same-origin relative /api paths. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? (isTauri() ? DEFAULT_API_BASE : ''),
}

/** True once the Supabase keys are present. Lets the UI render a shell without keys. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
