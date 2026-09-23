/** Native custom-scheme paths handled by `initDeepLinkAuth`. */
export type DayspringDeepLinkKind = 'auth-callback' | 'open'

export interface DayspringDeepLink {
  kind: DayspringDeepLinkKind
  url: string
}

/**
 * Classify a single URL. Only the `dayspring:` scheme is recognized.
 *
 * Accepts host form (`dayspring://open`) and path form (`dayspring:///open`),
 * with or without a trailing slash or query. Extra path segments are rejected
 * so `dayspring://open/plans` cannot be mistaken for open.
 *
 * `auth-callback` is identified by path only — a `code` query is not required
 * here; `completeOAuthCallback` still enforces it.
 */
export function parseDayspringDeepLink(raw: string): DayspringDeepLink | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol.toLowerCase() !== 'dayspring:') return null

  const host = url.hostname.toLowerCase()
  const path = url.pathname.replace(/\/+$/, '').toLowerCase()
  if (host && path !== '' && path !== '/') return null

  const token = host || path.replace(/^\//, '')
  if (token === 'auth-callback' || token === 'open') {
    return { kind: token, url: raw }
  }
  return null
}

/**
 * Choose which URL in a plugin-deep-link batch to handle.
 * `auth-callback` wins when both kinds are present.
 */
export function selectDayspringDeepLink(
  urls: readonly string[] | null | undefined,
): DayspringDeepLink | null {
  if (!urls?.length) return null
  const parsed: DayspringDeepLink[] = []
  for (const raw of urls) {
    const link = parseDayspringDeepLink(raw)
    if (link) parsed.push(link)
  }
  return parsed.find((l) => l.kind === 'auth-callback') ?? parsed.find((l) => l.kind === 'open') ?? null
}
