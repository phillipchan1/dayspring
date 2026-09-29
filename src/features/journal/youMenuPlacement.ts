/**
 * Where the portalled You menu sits.
 *
 * The trigger can be on the left (desktop rail) or the right (phone tab bar).
 * Left-aligning to the trigger — the old placement — puts a 268px menu past
 * the right edge of every iPhone. This helper prefers the trigger's left,
 * flips to its right when that would overflow, then clamps left+width into
 * the viewport minus gutters and safe-area insets.
 */

export const YOU_MENU_GUTTER = 8
export const YOU_MENU_PREFERRED_WIDTH = 268

export interface YouMenuBox {
  left: number
  width: number
}

export interface PlaceYouMenuArgs {
  triggerLeft: number
  triggerRight: number
  viewportWidth: number
  preferredWidth?: number
  gutter?: number
  safeLeft?: number
  safeRight?: number
}

export function placeYouMenu({
  triggerLeft,
  triggerRight,
  viewportWidth,
  preferredWidth = YOU_MENU_PREFERRED_WIDTH,
  gutter = YOU_MENU_GUTTER,
  safeLeft = 0,
  safeRight = 0,
}: PlaceYouMenuArgs): YouMenuBox {
  const minLeft = gutter + Math.max(0, safeLeft)
  const maxRight = viewportWidth - gutter - Math.max(0, safeRight)
  const available = Math.max(0, maxRight - minLeft)
  const width = Math.min(preferredWidth, available)

  let left = triggerLeft
  if (left + width > maxRight) left = triggerRight - width
  if (left < minLeft) left = minLeft
  if (left + width > maxRight) left = maxRight - width
  return { left, width }
}

/** Used values of the :root safe-area variables — 0 when they are unset. */
export function readSafeInsets(root: Element = document.documentElement): {
  left: number
  right: number
} {
  const style = getComputedStyle(root)
  const px = (name: string) => {
    const n = parseFloat(style.getPropertyValue(name))
    return Number.isFinite(n) ? n : 0
  }
  return { left: px('--safe-left'), right: px('--safe-right') }
}
