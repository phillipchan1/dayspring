// Version rules for the offline-first entry cache. Pure — no IO, no React — so
// the reconcile logic can be unit-tested without IndexedDB or a Supabase client.
//
// `updated_at` belongs to the SERVER's clock. It is set by the
// `entries_set_updated_at` trigger and only ever enters the cache by adopting a
// row the server handed back (see `pushEntry` in repo.ts). Every last-write-wins
// comparison therefore weighs one server clock against another.
//
// This matters more than it looks: while a locally-stamped `updated_at` sits in
// the cache, a device whose clock runs a few seconds fast reads its own stale row
// as newer than another device's genuinely newer edit and skips it — permanently,
// because the row is no longer in the outbox and so is never re-pushed or
// re-pulled. Adopting the server's answer is what closes that hole.

import type { Entry } from './types'

/**
 * May we overwrite the cached row with the copy the server just returned?
 *
 * Only when the cache still holds exactly what we pushed. If the user edited the
 * entry while the push was in flight, that edit queued its own outbox op and will
 * adopt the server's answer on its own push — overwriting it here would drop a
 * keystroke. A row deleted mid-flight is likewise left alone.
 */
export function shouldAdoptServerRow(pushed: Entry, current: Entry | undefined): boolean {
  if (!current) return false
  return (
    current.updated_at === pushed.updated_at &&
    current.local_edited_at === pushed.local_edited_at
  )
}

/**
 * Does `winner` already contain everything in `loser`?
 *
 * Asked before preserving the losing side of a conflict. The overwhelmingly
 * common "conflict" is not two people disagreeing — it is one device simply
 * further along: the same text plus another paragraph, or a push whose response
 * was lost and is being retried against a row it already wrote. Copying the
 * loser aside in those cases would manufacture exactly the duplicate entries
 * this codebase has fixed four times.
 *
 * Whitespace-insensitive at the edges, because block separation gets normalised
 * on the way through the editor.
 */
export function subsumes(winner: string, loser: string): boolean {
  const l = loser.trim()
  if (l === '') return true
  return winner.trim().includes(l)
}

/** Newest `updated_at` across rows, or null for an empty list. */
export function maxUpdatedAt(rows: Entry[]): string | null {
  let max: string | null = null
  for (const r of rows) if (max === null || r.updated_at > max) max = r.updated_at
  return max
}
