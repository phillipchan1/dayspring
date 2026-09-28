// First-party landing attribution — gclid / gbraid / wbraid plus the five
// utm_* keys. Parse and merge are pure so they can be unit-tested without a
// document; the cookie write lives in attributionCookie.ts.
//
// Last-touch, per key: a later non-empty value replaces the stored one; an
// empty visit never clears what we already have. Click IDs and UTMs follow
// the same rule independently — a gclid-only return must not wipe UTMs, and
// a UTM-only return must not wipe a stored gclid.

export const ATTRIBUTION_COOKIE = 'ds_attrib'
export const ATTRIBUTION_MAX_AGE_SEC = 90 * 24 * 60 * 60
export const ATTRIBUTION_COOKIE_DOMAIN = '.usedayspring.app'

export const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const
export const ATTRIBUTION_KEYS = [...CLICK_ID_KEYS, ...UTM_KEYS] as const

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number]
export type Attribution = Partial<Record<AttributionKey, string>>

function nonEmpty(value: string | null | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/** Pull attribution keys out of a query string (`?…` or raw). */
export function parseAttributionSearch(search: string): Attribution {
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw) return {}
  const params = new URLSearchParams(raw)
  const out: Attribution = {}
  for (const key of ATTRIBUTION_KEYS) {
    const value = nonEmpty(params.get(key))
    if (value) out[key] = value
  }
  return out
}

/** Decode a previously serialized cookie payload. */
export function parseAttributionCookie(value: string): Attribution {
  return parseAttributionSearch(value)
}

/**
 * Last non-empty value per key wins. Incoming empties are ignored so a
 * later direct visit cannot blank a stored click id or UTM.
 */
export function mergeAttribution(existing: Attribution, incoming: Attribution): Attribution {
  const out: Attribution = { ...existing }
  for (const key of ATTRIBUTION_KEYS) {
    const next = nonEmpty(incoming[key])
    if (next) out[key] = next
  }
  return out
}

export function serializeAttribution(attrs: Attribution): string {
  const params = new URLSearchParams()
  for (const key of ATTRIBUTION_KEYS) {
    const value = nonEmpty(attrs[key])
    if (value) params.set(key, value)
  }
  return params.toString()
}

export function hasAttribution(attrs: Attribution): boolean {
  return ATTRIBUTION_KEYS.some((key) => Boolean(nonEmpty(attrs[key])))
}

/** `.usedayspring.app` on our marketing host so any subdomain can read it. */
export function attributionCookieDomain(hostname: string): string | undefined {
  const host = hostname.toLowerCase()
  if (host === 'usedayspring.app' || host.endsWith('.usedayspring.app')) {
    return ATTRIBUTION_COOKIE_DOMAIN
  }
  return undefined
}

export function readNamedCookie(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length)
  }
  return null
}

export function decodeAttributionCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function formatAttributionSetCookie(
  serialized: string,
  opts: { domain?: string; maxAgeSec?: number; secure?: boolean },
): string {
  const parts = [
    `${ATTRIBUTION_COOKIE}=${encodeURIComponent(serialized)}`,
    'Path=/',
    `Max-Age=${opts.maxAgeSec ?? ATTRIBUTION_MAX_AGE_SEC}`,
    'SameSite=Lax',
  ]
  if (opts.secure !== false) parts.push('Secure')
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  return parts.join('; ')
}
