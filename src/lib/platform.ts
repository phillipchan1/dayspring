// Runtime platform detection for the Tauri wrappers (macOS desktop + iOS).
//
// The same dist/ bundle runs on the web (Vercel) and inside the native apps, so
// any desktop-only chrome (e.g. leaving room for the macOS traffic-light
// buttons under the overlay title bar) must be gated on these checks.

/** Compile-time: Vite sets this true only when Tauri builds the iOS target. */
function builtForIOS(): boolean {
  return typeof __TAURI_IOS__ !== 'undefined' && __TAURI_IOS__
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * iPadOS reports a Macintosh UA. The usual tell is maxTouchPoints; some
 * WKWebViews (desktop-site mode) have reported 0 or 1, so 0 is the floor —
 * a Mac trackpad still reports 0. The iOS binary also stamps `__TAURI_IOS__`.
 */
export function isAppleTouchDevice(
  ua = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return /Macintosh/i.test(ua) && maxTouchPoints > 0
}

/** True inside the Tauri app on a touch device (iPhone/iPad/Android).
 *  iPadOS masquerades as "Macintosh" in the UA, so multi-touch is the tell. */
export function isMobileTauri(): boolean {
  if (builtForIOS()) return true
  if (!isTauri()) return false
  return /Android/i.test(navigator.userAgent) || isAppleTouchDevice()
}

/** Tauri on an actual desktop (macOS/Windows/Linux) — the only place the
 *  overlay title bar, traffic-light insets, and auto-updater exist. */
export function isDesktopTauri(): boolean {
  return isTauri() && !isMobileTauri()
}

/**
 * True inside the native iOS/iPadOS app — the one place where App Store rules
 * apply, so billing must go through StoreKit and Stripe must be invisible.
 *
 * Deliberately narrower than isMobileTauri(): Android would also be "mobile",
 * but it is Google Play's rules that govern there, not Apple's. iPadOS reports
 * "Macintosh" in its UA, hence the maxTouchPoints tell — the same trick
 * isMobileTauri uses, restricted to Apple UAs.
 */
export function isIOSTauri(): boolean {
  if (builtForIOS()) return true
  if (!isTauri()) return false
  return isAppleTouchDevice()
}

// Tags <html data-platform="desktop"|"mobile"> inside the native app so CSS can
// adapt. No-ops in a plain browser. The iOS app must NOT get "desktop" — that
// would reserve room for macOS traffic lights and mark drag regions.
export function applyPlatformClass(): void {
  if (!isTauri() && !builtForIOS()) return
  const root = document.documentElement
  if (isMobileTauri()) {
    root.dataset.platform = 'mobile'
    return
  }
  root.dataset.platform = 'desktop'
  const style = root.style
  style.setProperty('--mac-traffic-x', MAC_TRAFFIC_INSET.sidebarX)
  style.setProperty('--mac-traffic-main-top', MAC_TRAFFIC_INSET.mainTop)
  style.setProperty('--mac-traffic-main-left-collapsed', MAC_TRAFFIC_INSET.mainLeftCollapsed)
}

/** Room for macOS traffic lights under Tauri’s overlay title bar. */
export const MAC_TRAFFIC_INSET = {
  /** Navigation rail top — push the Mark/nav below the traffic lights */
  railTop: '2.85rem',
  sidebarX: '1rem',
  /** Main toolbar when the entry list is visible */
  mainTop: '1.7rem',
  mainX: '1rem',
  /** Main toolbar when the list is hidden — lights sit over this strip */
  mainLeftCollapsed: '5.5rem',
} as const
