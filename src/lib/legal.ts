import { env } from './env'

/**
 * Canonical URLs for the Terms of Use and Privacy Policy.
 *
 * These are served by our own Vercel app (`public/legal/*.html`, routed to the
 * clean `/terms` and `/privacy` paths by vercel.json).
 *
 * They deliberately do NOT point at the marketing site (www.usedayspring.app),
 * which has no /terms or /privacy route, nor at the old `dayspring.app`, which
 * fails DNS entirely. A Privacy Policy link that 404s — or worse, doesn't
 * resolve — is an automatic App Store rejection under guideline 3.1.2, and that
 * was already the live state of the sign-in screen before this.
 *
 * If the legal pages later move onto the marketing domain, set VITE_TERMS_URL
 * and VITE_PRIVACY_URL rather than editing call sites.
 *
 * `env.apiBaseUrl` is '' on the web (so these stay same-origin relative) and the
 * absolute Vercel origin inside Tauri, where a relative path would resolve
 * against the app's own bundled asset origin and go nowhere.
 */
export function legalUrl(page: 'terms' | 'privacy'): string {
  const override =
    page === 'terms' ? import.meta.env.VITE_TERMS_URL : import.meta.env.VITE_PRIVACY_URL
  if (override) return override
  return `${env.apiBaseUrl}/${page}`
}
