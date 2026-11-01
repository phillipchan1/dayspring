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

export type PlatformKind = 'mac' | 'ios' | 'web'

/**
 * Coarse platform bucket for analytics (src/lib/analytics.ts's `app_open`).
 * 'mac' also covers a hypothetical future Windows/Linux desktop build:
 * isDesktopTauri() cannot yet tell them apart, because every desktop Tauri
 * build today is macOS-only. Revisit this derivation if that changes.
 */
export function platformKind(): PlatformKind {
  if (isIOSTauri()) return 'ios'
  if (isDesktopTauri()) return 'mac'
  return 'web'
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
  setFullscreenInsets(false)
}

/**
 * The traffic-light clearances are only owed while the lights are drawn. In
 * full screen macOS hides them (they slide in with the menu bar), so the frame
 * bar and the rail take the web's spacing instead of keeping an empty band
 * where three buttons used to be. Called by windowChrome.ts on every resize.
 */
export function setFullscreenInsets(fullscreen: boolean): void {
  if (typeof document === 'undefined') return
  const style = document.documentElement.style
  const vars: Array<[string, string]> = [
    ['--mac-traffic-x', MAC_TRAFFIC_INSET.sidebarX],
    ['--mac-traffic-main-top', MAC_TRAFFIC_INSET.mainTop],
    ['--mac-traffic-main-left-collapsed', MAC_TRAFFIC_INSET.mainLeftCollapsed],
    ['--mac-traffic-rail-top', MAC_TRAFFIC_INSET.railClearance],
  ]
  for (const [name, value] of vars) {
    if (fullscreen) style.removeProperty(name)
    else style.setProperty(name, value)
  }
}

/**
 * Where the native traffic lights sit — `trafficLightPosition` in
 * src-tauri/tauri.macos.conf.json, in points (src/lib/platform.test.ts holds
 * the two together).
 *
 * They are centred on the frame bar's first row, the way a unified toolbar
 * holds them in Notes and Mail: the row runs from `--frame-bar-top` (1.7rem)
 * for `--frame-bar-row` (2rem), so its middle is 2.7rem = 43.2pt down. Tao
 * keeps each button's own vertical offset inside the title-bar view it
 * resizes to `button height + y`, which puts a button's centre within a
 * point or two of `y`; 42 lands it on the row. Horizontally the three
 * buttons (54pt across) are centred over the collapsed rail's icon column
 * (`--rail-width` 4.5rem = 72pt): (72 − 54) / 2 = 9.
 *
 * Verify on a Mac after changing either number: the lights' centre should
 * line up with "← Pages" in the bar.
 */
export const MAC_TRAFFIC_LIGHTS = { x: 9, y: 42 } as const

/** Room for macOS traffic lights under Tauri’s overlay title bar. */
export const MAC_TRAFFIC_INSET = {
  /**
   * Navigation rail top — push the Mark/nav below the traffic lights. A CSS
   * reference rather than a length, so it lets go in full screen (see
   * setFullscreenInsets); 0.5rem is the rail's own padding on the web.
   */
  railTop: 'var(--mac-traffic-rail-top, 0.5rem)',
  /**
   * With the lights on the frame bar's row, the rail's first item starts
   * where the bar ends: its top clearance, its row and its floor.
   */
  railClearance: 'calc(var(--frame-bar-top) + var(--frame-bar-row) + var(--frame-bar-floor))',
  sidebarX: '1rem',
  /** Main toolbar when the entry list is visible */
  mainTop: '1.7rem',
  mainX: '1rem',
  /** Main toolbar when the list is hidden — lights sit over this strip */
  mainLeftCollapsed: '5.5rem',
} as const
