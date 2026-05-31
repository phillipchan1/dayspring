import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

// Service-role client for server jobs (cron / manual trigger). Bypasses RLS, so
// every write MUST set `owner` explicitly. Never import this from anything under
// src/ — the service-role key must never reach the client bundle.
let client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
