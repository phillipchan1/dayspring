// Deleting the account, from the app.
//
// The server does the destroying (api/account/delete.ts). This module's job is
// the other half of the promise: once the account is gone, nothing of it may be
// left sitting on this device either. A local IndexedDB cache full of entries
// that no longer exist anywhere is exactly the thing the user asked us to
// remove — see docs/ACCOUNT_DELETION.md.

import { apiUrl } from './api'
import { purgeAfterAccountDeletion } from './localData'
import { requireSupabase } from './supabase'

/** Why the server refused. Mirrors DeletionBlock in api/account/delete.ts. */
export type DeletionBlock = 'apple-will-renew' | 'apple-unknown'

/**
 * The server declined to delete because a store may still be charging.
 *
 * Carried as its own type so the UI can offer the way out (the App Store) with
 * the refusal, rather than showing a dead end.
 */
export class AccountDeletionBlocked extends Error {
  readonly blockedBy: DeletionBlock
  constructor(message: string, blockedBy: DeletionBlock) {
    super(message)
    this.name = 'AccountDeletionBlocked'
    this.blockedBy = blockedBy
  }
}

/**
 * Delete this account, then leave nothing behind locally.
 *
 * On success this does not return in any useful sense: the session is dropped,
 * the local caches are scrubbed and the page reloads to the signed-out state.
 * Reloading rather than re-rendering is deliberate — React state, open editors
 * and in-flight requests all still hold entries in memory, and the cheapest way
 * to be certain none of them survives is to start the app over.
 *
 * Throws `AccountDeletionBlocked` when a store may still be billing, and a
 * plain Error otherwise, both carrying the server's own wording.
 */
export async function deleteAccount(): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/account/delete'), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; blockedBy?: DeletionBlock }
    const message = body.error ?? `Deletion failed (${res.status}).`
    if (res.status === 409 && body.blockedBy) throw new AccountDeletionBlocked(message, body.blockedBy)
    throw new Error(message)
  }

  // The user this token belongs to no longer exists, so Supabase may well
  // reject the sign-out. That is not a failure worth surfacing — the account is
  // already gone, and the local scrub below is what actually matters here.
  try {
    await sb.auth.signOut()
  } catch {
    /* the session died with the account */
  }
  await purgeAfterAccountDeletion()

  window.location.reload()
}
