import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'

/** True when the URL is an OAuth / magic-link callback (not a normal app launch). */
function hasAuthCallbackInUrl(): boolean {
  if (typeof window === 'undefined') return false
  const { hash, search } = window.location
  return (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    search.includes('code=')
  )
}

// A single shared client. Null until the env keys are provided, so the app
// can still boot and render a "configure me" shell during early setup.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Only parse the URL on OAuth return — avoids touching storage on cold start.
        detectSessionInUrl: hasAuthCallbackInUrl(),
        flowType: 'pkce',
      },
    })
  : null

/** Throws if called before Supabase is configured — use where a client is required. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    )
  }
  return supabase
}
