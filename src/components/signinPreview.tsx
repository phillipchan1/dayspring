import { createRoot } from 'react-dom/client'
import { SignIn } from './SignIn'

/**
 * Dev-only: `?__preview=signin` — the login surface without a Supabase session.
 * Pretends to be iPad Tauri so email (review demo) and Apple-first order show.
 */
export function renderSignInPreview() {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root not found')
  ;(window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = {}
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 })
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () =>
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  })
  document.documentElement.dataset.platform = 'mobile'
  ;(window as unknown as { __DAYSPRING_SIGNIN_PREVIEW__: boolean }).__DAYSPRING_SIGNIN_PREVIEW__ =
    true
  createRoot(root).render(<SignIn />)
}
