// Runtime platform detection for the Tauri desktop wrapper.
//
// The same dist/ bundle runs on the web (Vercel) and inside the native app, so
// any desktop-only chrome (e.g. leaving room for the macOS traffic-light
// buttons under the overlay title bar) must be gated on this check.
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Tags <html data-platform="desktop"> inside the native app so CSS can adapt.
// No-ops in a plain browser.
export function applyPlatformClass(): void {
  if (!isTauri()) return
  const root = document.documentElement
  root.dataset.platform = 'desktop'
  const style = root.style
  style.setProperty('--mac-traffic-sidebar-top', MAC_TRAFFIC_INSET.sidebarTop)
  style.setProperty('--mac-traffic-x', MAC_TRAFFIC_INSET.sidebarX)
  style.setProperty('--mac-traffic-main-top', MAC_TRAFFIC_INSET.mainTop)
  style.setProperty('--mac-traffic-main-left-collapsed', MAC_TRAFFIC_INSET.mainLeftCollapsed)
}

/** Room for macOS traffic lights under Tauri’s overlay title bar. */
export const MAC_TRAFFIC_INSET = {
  /** Navigation rail top — push the Mark/nav below the traffic lights */
  railTop: '2.85rem',
  /** Sidebar brand + search block */
  sidebarTop: '2.85rem',
  sidebarX: '1rem',
  /** Main toolbar when the entry list is visible */
  mainTop: '1.7rem',
  mainX: '1rem',
  /** Main toolbar when the list is hidden — lights sit over this strip */
  mainLeftCollapsed: '5.5rem',
} as const
