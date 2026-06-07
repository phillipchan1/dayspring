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
import { supabase } from './lib/supabase'
import { initDeepLinkAuth } from './lib/auth'

async function bootstrap() {
  // Tag <html> as desktop before first paint so native-only layout (e.g. room for
  // the macOS traffic lights under the overlay title bar) applies immediately.
  applyPlatformClass()

  // Catch non-React errors (unhandled rejections, stray throws) and report them.
  installGlobalHandlers()

  // Desktop: start listening for the dayspring:// OAuth callback before anything
  // else, so a cold launch via the deep link is captured. No-op on web.
  void initDeepLinkAuth()

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
