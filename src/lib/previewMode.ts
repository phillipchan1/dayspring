/**
 * Dev-only preview-route detection, shared by the data seams that need to serve
 * fixtures instead of hitting Supabase (see src/features/appstore/).
 *
 * Callers must keep the `import.meta.env.DEV &&` guard at the call site so Vite
 * statically drops the whole branch — including the dynamic `import()` of the
 * fixtures — from a production build.
 */

/** True when the page was opened as an App Store listing preview. */
export function isListingPreview(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('__preview')?.startsWith('listing-') ?? false
}
