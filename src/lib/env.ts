// Centralised, typed access to environment configuration.
// Reads names only — actual secret values live in .env.local (gitignored).

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}

/** True once the Supabase keys are present. Lets the UI render a shell without keys. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
