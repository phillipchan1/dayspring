// Account-level profile flags that follow the user across devices (unlike the
// per-device settingsStore). Currently just the first-run Welcome flag.

import { requireSupabase } from './supabase'

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
