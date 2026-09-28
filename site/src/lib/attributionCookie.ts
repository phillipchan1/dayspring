// Persist landing attribution in a first-party cookie. No network, no
// third-party script — this only reads the current URL and document.cookie.
// See attribution.ts for the merge rules.

import {
  attributionCookieDomain,
  decodeAttributionCookieValue,
  formatAttributionSetCookie,
  hasAttribution,
  mergeAttribution,
  parseAttributionCookie,
  parseAttributionSearch,
  readNamedCookie,
  serializeAttribution,
  ATTRIBUTION_COOKIE,
} from './attribution'

export function persistLandingAttribution(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  cookieHeader: string = typeof document !== 'undefined' ? document.cookie : '',
  writeCookie: (value: string) => void = (value) => {
    document.cookie = value
  },
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
  secure: boolean = typeof window !== 'undefined' ? window.location.protocol === 'https:' : true,
): void {
  const incoming = parseAttributionSearch(search)
  if (!hasAttribution(incoming)) return

  const existingRaw = readNamedCookie(cookieHeader, ATTRIBUTION_COOKIE)
  const existing = existingRaw
    ? parseAttributionCookie(decodeAttributionCookieValue(existingRaw))
    : {}
  const merged = mergeAttribution(existing, incoming)
  const serialized = serializeAttribution(merged)
  if (!serialized) return

  writeCookie(
    formatAttributionSetCookie(serialized, {
      domain: attributionCookieDomain(hostname),
      secure,
    }),
  )
}
