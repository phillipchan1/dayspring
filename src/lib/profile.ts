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
 * Which side of the onboarding fork the user took.
 *   import          — brought an archive in
 *   fresh           — started from an empty editor
 *   import_deferred — wanted to import but was on a phone, where the archive
 *                     parse is refused; they entered the app without one
 */
export type OnboardingPath = 'import' | 'fresh' | 'import_deferred'

/**
 * Stamp the account as having completed (or skipped) the first-run onboarding
 * flow. Idempotent upsert; once set, the flow never reappears. Also marks the
 * legacy Welcome carousel as seen so it can't auto-fire after onboarding.
 *
 * Records which fork was taken. That split is a live persona experiment we were
 * running without reading the result (DECISIONS.md D-003), and it is what
 * settles D-002 — whether fresh-start is a viable acquisition path at all, or
 * whether everyone worth having arrives with history to import.
 */
export async function setOnboarded(path: OnboardingPath): Promise<void> {
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
      {
        owner: session.user.id,
        onboarded_at: new Date().toISOString(),
        has_seen_welcome: true,
        onboarding_path: path,
      },
      { onConflict: 'owner' },
    )
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
