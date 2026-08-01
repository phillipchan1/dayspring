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
    // The version in the URL is what makes a deploy visible to the browser.
    // sw.js is otherwise byte-identical every time, so without it the browser
    // sees no update, never re-runs activate, and never purges the old cache —
    // pinning the assets that aren't content-hashed (icons, fonts) forever.
    // It also becomes the cache name inside the worker.
    navigator.serviceWorker.register(`/sw.js?v=${__APP_VERSION__}`).catch((err) => {
      // Non-fatal — the app works fine without the SW, just without offline.
      console.warn('[pwa] service worker registration failed:', err)
    })
  })
}
