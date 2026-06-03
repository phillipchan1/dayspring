// Account-level profile flags that follow the user across devices (unlike the
// per-device settingsStore). Includes the first-run Welcome flag and synced
// settings (so font/size/etc match on both desktop and web).

import { requireSupabase } from './supabase'
import type { Settings } from './settings'

/** Read the account's `has_seen_welcome`. Returns false when no row exists yet. */
export async function getWelcomeSeen(): Promise<boolean> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('has_seen_welcome')
    .maybeSingle()
  if (error) throw error
  return data?.has_seen_welcome ?? false
}

/** Persist that the account has seen the Welcome flow. Idempotent upsert. */
export async function setWelcomeSeen(): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return
  await sb
    .from('profiles')
    .upsert({ owner: session.user.id, has_seen_welcome: true }, { onConflict: 'owner' })
    .throwOnError()
}

/**
 * Pull the user's saved settings from the cloud.
 * Returns null when no profile row exists yet or no settings have been saved.
 */
export async function loadRemoteSettings(): Promise<Partial<Settings> | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('settings')
    .maybeSingle()
  if (error || !data?.settings) return null
  const s = data.settings as Record<string, unknown>
  return Object.keys(s).length > 0 ? (s as Partial<Settings>) : null
}

/**
 * Push the current settings to the cloud. Idempotent upsert.
 * Best-effort — callers should swallow errors.
 */
export async function saveRemoteSettings(settings: Settings): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return
  await sb
    .from('profiles')
    .upsert({ owner: session.user.id, settings }, { onConflict: 'owner' })
    .throwOnError()
}
