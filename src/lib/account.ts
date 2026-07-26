import { apiPost } from './api'
import { requireSupabase } from './supabase'
import { purgeOnSignOut } from './localData'

export interface DeleteAccountResult {
  /** True when the account was billed through Apple and the subscription is
   *  still live. Only the user can cancel that, from iOS Settings — we can't,
   *  so the UI has to say so rather than let them assume deletion stopped it. */
  appleSubscriptionActive: boolean
}

/**
 * Permanently delete the signed-in account: cancels Stripe, drops uploaded
 * images, removes the auth user (which cascades every owned table), then
 * scrubs this device's local cache and ends the session.
 *
 * There is no undo and no soft-delete window — the caller is responsible for
 * getting an explicit confirmation first.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const res = await apiPost<{ deleted: boolean; appleSubscriptionActive?: boolean }>(
    '/api/account/delete',
    { confirm: 'DELETE' },
  )
  if (!res.deleted) throw new Error('account deletion failed')

  // Local cleanup. The server is already done, so failures here must not
  // surface as "deletion failed" — the account really is gone either way.
  try {
    await purgeOnSignOut()
    await requireSupabase().auth.signOut()
  } catch {
    /* the session dies with the user row regardless */
  }

  return { appleSubscriptionActive: res.appleSubscriptionActive ?? false }
}
