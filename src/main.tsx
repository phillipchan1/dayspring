import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/400-italic.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
// Reflections typography: Fraunces (display) + Newsreader (the writer's words).
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/newsreader/600.css'
// Writing-font picker faces (self-hosted, no CDN): typewriter + readable.
import '@fontsource/ia-writer-duo/400.css'
import '@fontsource/ia-writer-duo/400-italic.css'
import '@fontsource/ia-writer-duo/700.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/400-italic.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import './styles/global.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applyPlatformClass } from './lib/platform'
import { installGlobalHandlers } from './lib/crashReport'
import { installDropGuard } from './lib/dropGuard'
import { supabase } from './lib/supabase'
import { initDeepLinkAuth } from './lib/auth'
import { registerServiceWorker } from './lib/registerSW'
import { installAnalytics } from './lib/analytics/posthog'

async function bootstrap() {
  // Dev-only App Store previews: render a surface standalone, with no auth and
  // no subscription setup, so screenshots can be captured from a browser instead
  // of a provisioned device.
  //
  //   ?__preview=locked | paywall   → IAP review shot (capture-appstore-screenshots.mjs)
  //   ?__preview=listing-*          → marketing listing shots (capture-listing-screenshots.mjs)
  //
  // Must run BEFORE the awaits below — a headless capture otherwise fires while
  // bootstrap is still waiting on the Supabase session and photographs a blank
  // page. `import.meta.env.DEV` is statically false in a production build, so
  // Vite dead-code-eliminates this entire block; it can never ship.
  if (import.meta.env.DEV) {
    const preview = new URLSearchParams(window.location.search).get('__preview')
    if (preview?.startsWith('listing-')) {
      const { renderListingPreview } = await import('./features/appstore/preview')
      renderListingPreview(preview)
      return
    }
    if (preview) {
      const { renderPaywallPreview } = await import('./features/paywall/preview')
      renderPaywallPreview(preview)
      return
    }
  }

  // Tag <html> as desktop before first paint so native-only layout (e.g. room for
  // the macOS traffic lights under the overlay title bar) applies immediately.
  applyPlatformClass()

  // Catch non-React errors (unhandled rejections, stray throws) and report them.
  installGlobalHandlers()

  // Neutralize stray file drops so a photo dropped outside a dropzone can't make
  // the WebView navigate to the file and blow away the whole app.
  installDropGuard()

  // Desktop: start listening for the dayspring:// OAuth callback before anything
  // else, so a cold launch via the deep link is captured. No-op on web.
  void initDeepLinkAuth()

  // Web only: register the PWA service worker so the app is installable on a
  // phone and opens offline. No-op inside the Tauri apps and in dev.
  registerServiceWorker()

  // Finish reading persisted session / OAuth callback before we choose Sign-in vs journal.
  if (supabase) {
    await supabase.auth.getSession()
  }

  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element #root not found')

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary variant="root">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )

  // Install the usage-event transport LAST, and after render is queued, so the
  // vendor bundle can never compete with first paint. This call is cheap and
  // synchronous: it registers the seam and a settings subscription, then boots
  // posthog-js at idle — and only if the user has opted in. See
  // lib/analytics/posthog.ts for why initialisation itself is gated.
  installAnalytics()
}

void bootstrap()
