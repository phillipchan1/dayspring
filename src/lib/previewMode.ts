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
const CAPTURE_PREVIEWS = ['listing-', 'flagship']

/** True when the page was opened as one of the marketing capture previews. */
export function isCapturePreview(): boolean {
  if (typeof window === 'undefined') return false
  const preview = new URLSearchParams(window.location.search).get('__preview')
  if (!preview) return false
  return CAPTURE_PREVIEWS.some((p) => preview.startsWith(p))
}
