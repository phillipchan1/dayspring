import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Service-role client for server jobs (cron / manual trigger). Bypasses RLS, so
// every write MUST set `owner` explicitly. Never import this from anything under
// src/ — the service-role key must never reach the client bundle.
let client: SupabaseClient | null = null

/**
 * Cloudflare Worker hook (worker/src/vercel/bridge.ts): when set, returns the
 * per-request Neon-backed client instead of the Supabase one. Unset on Vercel.
 */
let override: (() => SupabaseClient) | null = null
export function setSupabaseAdminOverride(fn: (() => SupabaseClient) | null): void {
  override = fn
}

export function supabaseAdmin(): SupabaseClient {
  if (override) return override()
  if (!client) {
    client = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
