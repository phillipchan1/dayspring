import { isTauri } from './platform'

// Registers the service worker that makes the web app installable (PWA) and
// resilient offline. Deliberately a no-op when:
//   - running inside the Tauri desktop/iOS shell (it has its own asset layer and
//     a custom protocol; a SW there would only get in the way), or
//   - in dev (`import.meta.env.PROD` is false) so it never fights Vite HMR, or
//   - the browser has no Service Worker support.
export function registerServiceWorker(): void {
  if (isTauri()) return
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Non-fatal — the app works fine without the SW, just without offline.
      console.warn('[pwa] service worker registration failed:', err)
    })
  })
}
