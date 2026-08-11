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
 * Stamp the account as having completed (or skipped) the first-run onboarding
 * flow. Idempotent upsert; once set, the flow never reappears. Also marks the
 * legacy Welcome carousel as seen so it can't auto-fire after onboarding.
 */
export async function setOnboarded(): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return
  try {
    localStorage.setItem('dayspring.has_seen_welcome', 'true')
  } catch {
    /* ignore */
  }
  await sb
    .from('profiles')
    .upsert(
      { owner: session.user.id, onboarded_at: new Date().toISOString(), has_seen_welcome: true },
      { onConflict: 'owner' },
    )
    .throwOnError()
}

/** Read the account's last-acked processing-completion key, or null if none. */
export async function getAckedCompletion(): Promise<string | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('acked_processing_completion')
    .maybeSingle()
  if (error) throw error
  return data?.acked_processing_completion ?? null
}

/** Persist that the account has acked this processing completion. Idempotent upsert. */
export async function setAckedCompletion(key: string): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return
  await sb
    .from('profiles')
    .upsert({ owner: session.user.id, acked_processing_completion: key }, { onConflict: 'owner' })
    .throwOnError()
}

/**
 * Pull the user's saved settings from the cloud.
 *
 * Returns null when the account genuinely has none saved yet, and THROWS when
 * the fetch failed. The two used to be indistinguishable, which let a device
 * that couldn't reach the network conclude "nothing saved" and push its defaults
 * over the settings the user had deliberately chosen elsewhere.
 */
export async function loadRemoteSettings(): Promise<Partial<Settings> | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('settings')
    .maybeSingle()
  if (error) throw error
  if (!data?.settings) return null
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
