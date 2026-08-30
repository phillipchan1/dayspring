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
import { initPostHog } from './lib/posthog'

async function bootstrap() {
  // Dev-only App Store previews: render a surface standalone, with no auth and
  // no subscription setup, so screenshots can be captured from a browser instead
  // of a provisioned device.
  //
  //   ?__preview=locked | paywall   → IAP review shot (capture-appstore-screenshots.mjs)
  //   ?__preview=listing-*          → marketing listing shots (capture-listing-screenshots.mjs)
  //   ?__preview=ad-*               → paid-social ad creative (capture-ads.mjs)
  //   ?__preview=applock*           → app-lock surfaces (features/applock/preview.tsx)
  //   ?__preview=pages              → the read surface, in a phone frame (features/pages/preview.tsx)
  //   ?__preview=noticing           → the engine sandbox on synthetic entries (features/bench/preview.tsx)
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
    if (preview?.startsWith('ad-')) {
      const { renderAdPreview } = await import('./features/ads/preview')
      renderAdPreview(preview)
      return
    }
    if (preview?.startsWith('applock')) {
      const { renderAppLockPreview } = await import('./features/applock/preview')
      await renderAppLockPreview(preview)
      return
    }
    if (preview === 'noticing') {
      ;(await import('./features/bench/preview')).renderNoticingPreview()
      return
    }
    if (preview === 'pages') {
      const { renderPagesPreview } = await import('./features/pages/preview')
      renderPagesPreview()
      return
    }
    if (preview === 'highlight') {
      const { renderHighlightPreview } = await import('./editor/highlightPreview')
      renderHighlightPreview()
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

  // Vendor for the anonymous usage events in lib/analytics.ts. No-ops without
  // VITE_POSTHOG_KEY. Gated on Settings → About → "Share anonymous usage".
  initPostHog()

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
}

void bootstrap()
