/**
 * Dev-only preview-route detection, shared by the data seams that need to serve
 * fixtures instead of hitting Supabase (see src/features/appstore/ and
 * src/features/flagship/).
 *
 * Callers must keep the `import.meta.env.DEV &&` guard at the call site so Vite
 * statically drops the whole branch — including the dynamic `import()` of the
 * fixtures — from a production build.
 *
 * THIS IS A PRIVACY BOUNDARY, not only a convenience. Every route it covers
 * produces a PUBLIC asset — an App Store screenshot, an ad, the flagship hero.
 * Without it those captures render whatever account the machine happens to be
 * signed into: on a developer's own laptop, that is their real prayers and the
 * real verses they have written down, composited into a marketing image. The
 * fixtures are fabricated precisely so that cannot happen.
 */

/** Prefixes whose previews must never touch live data. */
const CAPTURE_PREVIEWS = ['listing-', 'flagship', 'screens']

/**
 * Latched: once a page is a capture preview it stays one. In-app navigation
 * rewrites the URL (`history.replaceState` in lib/appHistory.ts) and drops
 * `?__preview=` — the iPad Ascent shot navigates to the Summit before its year
 * loads — and an unlatched check would then send that load to the live account.
 */
let latched = false

/** True when the page was opened as one of the marketing capture previews. */
export function isCapturePreview(): boolean {
  if (latched) return true
  if (typeof window === 'undefined') return false
  const preview = new URLSearchParams(window.location.search).get('__preview')
  if (!preview) return false
  latched = CAPTURE_PREVIEWS.some((p) => preview.startsWith(p))
  return latched
}

// Read once at boot, while the URL still carries `?__preview=`, so the latch
// holds even if the first caller only asks after a navigation.
isCapturePreview()
