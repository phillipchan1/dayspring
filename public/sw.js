/* Dayspring service worker.
 *
 * Goal: make the web app installable + resilient offline WITHOUT interfering
 * with the app's own data layer (Supabase, /api routes, OAuth callbacks).
 *
 * Strategy:
 *   - Only ever touch same-origin GET requests.
 *   - Navigations (HTML): network-first, fall back to the cached app shell so a
 *     cold launch works offline. Always prefer fresh HTML when online so the
 *     shell never points at stale hashed assets.
 *   - Hashed build assets (/assets/*) + icons/fonts: cache-first (they are
 *     content-hashed and immutable, so this is safe and fast).
 *   - Everything else (API, auth, cross-origin, non-GET) is left untouched —
 *     the request goes straight to the network as if no SW existed.
 *
 * Bump CACHE_VERSION to force old caches to be discarded on the next activate.
 */
const CACHE_VERSION = 'v1'
const CACHE_NAME = `dayspring-${CACHE_VERSION}`
const APP_SHELL = '/index.html'

// Precache the offline shell + install assets so the app opens with no network.
const PRECACHE_URLS = [
  APP_SHELL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-256.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Best-effort: a single 404 shouldn't abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

// Allow the page to trigger an immediate activation after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isHashedAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|ttf|otf|png|svg|jpg|jpeg|webp|gif|ico)$/i.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET; let the browser do everything else (POST to /api, etc.).
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Same-origin only — never intercept Supabase, OpenAI, Stripe, fonts CDNs…
  if (url.origin !== self.location.origin) return

  // Never cache the API or OAuth callback — these must always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // App navigations: network-first with offline fallback to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy))
          return response
        })
        .catch(() => caches.match(APP_SHELL).then((cached) => cached || Response.error())),
    )
    return
  }

  // Hashed/static assets: cache-first, then populate the cache on miss.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
      }),
    )
  }
})
