export type DeleteLanding =
  /** Nothing moves. The surface you are on is still there. */
  | { action: 'stay' }
  /** The editor opens on `entryId`; null is a blank draft. */
  | { action: 'open'; entryId: string | null }
  /** The entry being written was deleted from under the editor — pick a neighbour. */
  | { action: 'away' }

/**
 * Where a delete leaves you.
 *
 * The wall names a survivor (`focusAfterId`) so it can keep the focus ring in
 * step with the card that slid into the gap. That id was written when the list
 * sat beside the editor, where "focus the survivor" meant "open the survivor" —
 * so it also carried the editor to it. With the wall taking the whole canvas
 * (D-025) that same call threw you out of the surface you were deleting from and
 * into a page you never chose, with the wall gone behind it. On the wall a
 * delete stays on the wall; the wall moves its own focus.
 */
export function deleteLanding(opts: {
  onWall: boolean
  focusAfterId: string | null | undefined
  openEntryId: string | null
  deletedIds: readonly string[]
}): DeleteLanding {
  if (opts.onWall) return { action: 'stay' }
  if (opts.focusAfterId !== undefined) return { action: 'open', entryId: opts.focusAfterId }
  if (opts.openEntryId && opts.deletedIds.includes(opts.openEntryId)) return { action: 'away' }
  return { action: 'stay' }
}

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
