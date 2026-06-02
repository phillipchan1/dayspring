import type { Entry } from '@/lib/types'
import type { EntryGroup } from './groupEntries'

/** Chronological list order for shift-range selection (newest first). */
export function orderedEntryIds(entries: Entry[], groups: EntryGroup[] | null): string[] {
  if (groups) return groups.flatMap((g) => g.entries.map((e) => e.id))
  return entries.map((e) => e.id)
}

/**
 * After deleting one or more rows, pick the next list focus: the row that was
 * directly below the first deleted item, or the row above if none (Finder-style).
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
