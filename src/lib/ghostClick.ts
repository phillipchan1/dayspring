/**
 * iOS synthesizes a click ~300ms after the tap that opened an overlay.
 * The opening `touchstart` is already over, so a `setTimeout(0)` listener
 * still sees that click — and if the new sheet is shorter than the one that
 * was just closed, the click lands on the scrim and dismisses it. Scripture
 * with no surrounding text is a short search field; with text it grows. That
 * is why the second sheet sometimes stayed and sometimes vanished.
 */
export const GHOST_CLICK_MS = 400

export function isGhostClick(
  openedAt: number,
  now = Date.now(),
  windowMs = GHOST_CLICK_MS,
): boolean {
  return now - openedAt < windowMs
}
