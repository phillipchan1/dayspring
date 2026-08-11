/**
 * The support site.
 *
 * Unlike the legal pages (see legal.ts), help lives on the marketing domain —
 * it's a static Astro site in the `dayspring-site` repo, and it's the same URL
 * from the web app, the Mac app and iOS. So this is always absolute: inside
 * Tauri a relative path would resolve against the app's own bundled asset
 * origin and go nowhere.
 *
 * Override with VITE_HELP_URL rather than editing call sites.
 */
export const HELP_URL: string =
  (import.meta.env.VITE_HELP_URL as string | undefined) || 'https://www.usedayspring.app/help'

/** Where "get in touch" goes — the contact form, not a raw mailto. */
export const HELP_CONTACT_URL = `${HELP_URL}/contact`

/** The support inbox, for the places a mailto genuinely is the right answer. */
export const SUPPORT_EMAIL = 'hello@usedayspring.app'
