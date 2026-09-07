/** Movement (px) that still counts as a tap. Matches useSheetDismiss's 8px
 *  axis-lock, plus a little for a fat thumb starting a scroll. */
export const TAP_SLOP = 10

/**
 * A scroll starts with a finger on a row. `touchend` still fires on that row,
 * and treating it as a choice closed the sheet before anyone could pick.
 */
export function isTapGesture(
  start: { x: number; y: number },
  end: { x: number; y: number },
  slop = TAP_SLOP,
): boolean {
  return Math.abs(end.x - start.x) <= slop && Math.abs(end.y - start.y) <= slop
}
