// Server side of the passive demographics stamp (see the demographics
// migration for what this is for and the guardrail on how it may be used).
//
// Two sources meet here:
//   - the client body — platform, form factor, timezone, locale
//   - the request itself — country/region, which the edge attaches and the
//     client can neither see nor forge
//
// The client half is user-controlled input on its way to the database, so
// everything is validated against a closed allowlist and anything unrecognised
// is dropped silently rather than rejected. A stale app sending a platform
// value we retired must not fail its own sign-in over a metrics field.

/** Mirrors src/lib/clientContext.ts. Kept in sync by the DB check constraints. */
const PLATFORMS = ['web', 'desktop', 'ios', 'android'] as const
const FORM_FACTORS = ['phone', 'tablet', 'desktop'] as const

// "America/Argentina/Buenos_Aires", "UTC", "Etc/GMT+5".
const TIMEZONE_RE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/
// BCP-47 as browsers actually emit it: "en", "en-US", "zh-Hant-TW".
const LOCALE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/
const COUNTRY_RE = /^[A-Z]{2}$/
const REGION_RE = /^[A-Za-z0-9-]{1,10}$/

export interface DemographicsStamp {
  platform?: string
  platforms?: string[]
  form_factor?: string
  timezone?: string
  locale?: string
  country?: string
  region?: string
  signup_provider?: string
  last_seen_at: string
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined
}

function matching(value: unknown, re: RegExp, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return undefined
  return re.test(trimmed) ? trimmed : undefined
}

/** Body of POST /api/profile/ensure. Never throws — a malformed body yields {}. */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Geolocation the edge attached to this request. Vercel sets these on every
 * function invocation, including the cross-origin calls from the Tauri shells,
 * so desktop and iOS are covered the same as the web. Absent locally.
 */
function edgeGeo(req: Request): { country?: string; region?: string } {
  const country = matching(req.headers.get('x-vercel-ip-country'), COUNTRY_RE, 2)
  const region = matching(req.headers.get('x-vercel-ip-country-region'), REGION_RE, 10)
  return { ...(country ? { country } : {}), ...(region ? { region } : {}) }
}

/**
 * Build the columns to write. Only keys with a real value are returned, so an
 * older client that sends nothing leaves every existing value intact instead of
 * nulling it out.
 *
 * Update semantics, per field:
 *   platform/form_factor/timezone/locale/country/region — latest wins. People
 *     travel, change devices, and move; the current answer is the useful one.
 *   platforms — accumulates. Union with what is already recorded, so switching
 *     to the phone never erases the fact that they also use the desktop app.
 *   signup_provider — first write wins. Linking Apple onto a Google account
 *     later must not rewrite how the account actually started.
 */
export function demographicsStamp(
  req: Request,
  body: Record<string, unknown>,
  existing: { platforms?: string[] | null; signup_provider?: string | null } | null,
  authProvider: string | undefined,
  now: Date,
): DemographicsStamp {
  const platform = oneOf(body.platform, PLATFORMS)
  const formFactor = oneOf(body.form_factor, FORM_FACTORS)
  const timezone = matching(body.timezone, TIMEZONE_RE, 64)
  const locale = matching(body.locale, LOCALE_RE, 32)
  const { country, region } = edgeGeo(req)

  const seen = new Set(existing?.platforms ?? [])
  const platforms = platform && !seen.has(platform) ? [...seen, platform] : undefined

  const signupProvider =
    !existing?.signup_provider && oneOf(authProvider, ['google', 'apple'] as const)

  return {
    ...(platform ? { platform } : {}),
    ...(platforms ? { platforms } : {}),
    ...(formFactor ? { form_factor: formFactor } : {}),
    ...(timezone ? { timezone } : {}),
    ...(locale ? { locale } : {}),
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
    ...(signupProvider ? { signup_provider: signupProvider } : {}),
    last_seen_at: now.toISOString(),
  }
}
