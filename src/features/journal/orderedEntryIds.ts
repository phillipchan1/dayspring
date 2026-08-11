import type { Entry } from '@/lib/types'
import type { EntryGroup } from './groupEntries'

/**
 * Chronological order for shift-range selection (newest first).
 *
 * The list and the wall order the same entries differently — the list follows
 * its date grouping, the wall follows `pages/wallItems.ts`. Both feed the same
 * `indexOf`-based range selection, so each supplies its own order.
 */
export function orderedEntryIds(entries: Entry[], groups: EntryGroup[] | null): string[] {
  if (groups) return groups.flatMap((g) => g.entries.map((e) => e.id))
  return entries.map((e) => e.id)
}

/**
 * After deleting one or more pages, pick where the focus lands: the page
 * directly after the first deleted one, or the page before if there is none
 * (Finder-style). On the wall that means the card which has just slid into the
 * gap — i.e. where the eye already is.
 *
 */
export function nextEntryIdAfterDelete(
  orderIds: readonly string[],
  deletedIds: readonly string[],
): string | null {
  if (orderIds.length === 0) return null
  const deleted = new Set(deletedIds)
  const remaining = orderIds.filter((id) => !deleted.has(id))
  if (remaining.length === 0) return null

  const anchorIdx = orderIds.findIndex((id) => deleted.has(id))
  if (anchorIdx === -1) return remaining[0]!

  for (let i = anchorIdx + 1; i < orderIds.length; i++) {
    const id = orderIds[i]!
    if (!deleted.has(id)) return id
  }
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const id = orderIds[i]!
    if (!deleted.has(id)) return id
  }
  return remaining[0]!
}
