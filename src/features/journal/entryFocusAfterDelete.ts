/**
 * Where the focus lands after a delete: the page directly after the first
 * deleted one, or the page before if there is none (Finder-style) — the card
 * which has just slid into the gap, i.e. where the eye already is.
 *
 * This used to sit beside `orderedEntryIds`, which reconciled two orders: the
 * list's date grouping and the wall's. There is one order now (D-025 took the
 * list), so the caller passes the wall's own and nothing needs reconciling.
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
