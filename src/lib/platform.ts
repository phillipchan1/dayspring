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
  if (isTauri()) {
    document.documentElement.dataset.platform = 'desktop'
  }
}
