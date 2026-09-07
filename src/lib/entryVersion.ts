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
 * Whitespace-insensitive throughout, not just at the edges: block separation
 * gets normalised on the way through the editor, and a reflowed blank line must
 * never read as the user having written something different.
 */
const normalizeWs = (s: string): string => s.replace(/\s+/g, ' ').trim()

/**
 * Does `winner` already contain everything in `loser`?
 *
 * Asked before preserving the losing side of a conflict. The overwhelmingly
 * common "conflict" is not two people disagreeing — it is one device simply
 * further along: the same text plus another paragraph, or a push whose response
 * was lost and is being retried against a row it already wrote. Copying the
 * loser aside in those cases would manufacture exactly the duplicate entries
 * this codebase has fixed four times.
 */
export function subsumes(winner: string, loser: string): boolean {
  const l = normalizeWs(loser)
  if (l === '') return true
  return normalizeWs(winner).includes(l)
}

/**
 * Have our copy and the server's copy genuinely diverged — both moved away from
 * the last version we agreed on?
 *
 * `subsumes` alone cannot answer this. It compares the two bodies to each other,
 * so it reads "they hold text we deleted" and "they hold the version we started
 * from, and we since fixed a typo in it" as the same thing. They are opposites,
 * and only the first is a conflict. Treating the second as one is what forked a
 * user's entry into a full copy and a partial one: a cron bumping `updated_at`
 * on an untouched row made every subsequent push look like a foreign edit, and
 * any edit that was not a pure append then failed the substring test.
 *
 * With the common ancestor in hand the question is answerable rather than
 * guessable. If the server still holds the ancestor, there is nothing there we
 * don't already have, whatever its timestamp says. Only when BOTH sides have
 * moved is there a second version worth keeping.
 *
 * Falls back to `subsumes` when there is no known ancestor (a row created
 * offline, or cached before `base_body_markdown` existed).
 */
export function divergedFromBase(local: Entry, serverBody: string): boolean {
  const base = local.base_body_markdown
  if (base === undefined) return !subsumes(local.body_markdown, serverBody)
  const nBase = normalizeWs(base)
  // They never moved off the version we already had: a derived-column write, a
  // lost response being retried, our own echo. Nothing of theirs to lose.
  if (normalizeWs(serverBody) === nBase) return false
  // We never moved off it: their copy is strictly newer, so adopting it loses
  // nothing of ours.
  if (normalizeWs(local.body_markdown) === nBase) return false
  return !subsumes(local.body_markdown, serverBody)
}

/**
 * Would applying this incoming remote row actually change anything locally?
 *
 * Pure, and the single source of truth for that decision, so the cheap pre-filter
 * over a realtime burst and the merge that follows it can never disagree.
 *
 * Answering "no" cheaply matters: a server-side backfill touching every row emits
 * an event per entry, and treating that flood as real change used to force every
 * connected device into a full library download.
 */
export function shouldApplyRemote(
  remote: Entry,
  local: Entry | undefined,
  { pending, preserved }: { pending: boolean; preserved: boolean },
): boolean {
  // A queued local write is newer by definition; an entry being edited on screen
  // is the user's to keep until they stop.
  if (pending || preserved) return false
  if (!local) return true
  if (local.updated_at > remote.updated_at) return false
  // Byte-identical: our own echo coming back.
  return !(local.updated_at === remote.updated_at && local.body_markdown === remote.body_markdown)
}

/**
 * May we take this remote row's `updated_at` WITHOUT taking its body?
 *
 * `shouldApplyRemote` is right to refuse a row with a queued local write — but
 * refusing the whole row also strands the timestamp, and the timestamp is the
 * base the next push declares. While someone types there is always a queued
 * write, so a `updated_at` that moved without the body moving could never be
 * learned, and the next push was guaranteed to declare a base the server had
 * passed. That is the stale base the entry-forking bug grew out of.
 *
 * Safe precisely when the server's body is still the ancestor we already hold:
 * there is nothing there to lose, so this only ever advances a clock.
 */
export function shouldAdoptRemoteTimestamp(remote: Entry, local: Entry | undefined): boolean {
  if (!local || local.base_body_markdown === undefined) return false
  if (remote.updated_at <= local.updated_at) return false
  return remote.body_markdown === local.base_body_markdown
}

/**
 * Stamp a row the server just handed us as its own ancestor: what it holds now
 * is, by definition, the last version we and the server agreed on.
 */
export function withServerBase(server: Entry): Entry {
  return { ...server, base_body_markdown: server.body_markdown }
}

/** Newest `updated_at` across rows, or null for an empty list. */
export function maxUpdatedAt(rows: Entry[]): string | null {
  let max: string | null = null
  for (const r of rows) if (max === null || r.updated_at > max) max = r.updated_at
  return max
}
