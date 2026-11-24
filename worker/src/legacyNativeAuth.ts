/**
 * Server-side shim for native builds shipped before /api/auth/native/start
 * (4093c52d): iOS App Store 1.0.1349 (2c6dd0da) and Mac builds of that age.
 *
 * Those clients start Better Auth's social flow from the webview
 * (POST /sign-in/social, callbackURL = the old eosin bridge, disableRedirect),
 * open the returned Google URL in ASWebAuthenticationSession / the system
 * browser, and finish with `GET /api/auth/callback/apple?code=<code>` (no
 * state) from the webview. The state cookie lands in the webview, not the
 * sheet, so Google's callback fails with `state_mismatch` in the sheet.
 *
 * Without an app release we steer them onto the current native flow:
 *  1. POST /sign-in/social with the legacy callbackURL → we answer with the
 *     URL of /api/auth/native/start (no state is created in the webview). The
 *     sheet opens it, so the state cookie and the provider round-trip live in
 *     the sheet. Finish ends at dayspring://auth-callback/?code=<one-time token>,
 *     which the legacy app already parses.
 *  2. GET /api/auth/callback/{google,apple}?code=… with NO state → treated as
 *     the legacy one-time-token exchange and re-issued as
 *     POST /one-time-token/verify (single use, 3 minutes, hashed at rest).
 *     A real provider callback always carries `state`, and Better Auth fails
 *     every state-less callback with state_not_found, so no working path
 *     changes. This grants nothing POST /one-time-token/verify doesn't already.
 */
export const LEGACY_NATIVE_CALLBACK_URL = 'https://dayspring-eosin.vercel.app/auth/callback'

const LEGACY_PROVIDERS = new Set(['google', 'apple'])
const SOCIAL_SIGN_IN_PATH = '/api/auth/sign-in/social'
const CALLBACK_PATH = /^\/api\/auth\/callback\/(google|apple)\/?$/
const VERIFY_PATH = '/api/auth/one-time-token/verify'

export type LegacyNativeAuth =
  | { kind: 'respond'; response: Response }
  | { kind: 'forward'; request: Request }
  | null

export async function legacyNativeAuth(req: Request, baseURL: string): Promise<LegacyNativeAuth> {
  const url = new URL(req.url)

  if (req.method === 'POST' && url.pathname === SOCIAL_SIGN_IN_PATH) {
    type SocialBody = { provider?: unknown; callbackURL?: unknown; idToken?: unknown; disableRedirect?: unknown }
    let body: SocialBody
    try {
      const parsed: unknown = await req.clone().json()
      if (!parsed || typeof parsed !== 'object') return null
      body = parsed as SocialBody
    } catch {
      return null
    }
    if (
      body.callbackURL !== LEGACY_NATIVE_CALLBACK_URL
      || body.idToken
      || typeof body.provider !== 'string'
      || !LEGACY_PROVIDERS.has(body.provider)
    ) return null
    const start = `${baseURL.replace(/\/$/, '')}/api/auth/native/start?${new URLSearchParams({ provider: body.provider })}`
    return {
      kind: 'respond',
      response: new Response(JSON.stringify({ url: start, redirect: body.disableRedirect !== true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      }),
    }
  }

  if (req.method === 'GET' && CALLBACK_PATH.test(url.pathname)) {
    const code = url.searchParams.get('code')
    if (!code || url.searchParams.has('state') || url.searchParams.has('error')) return null
    const headers = new Headers()
    for (const name of ['origin', 'authorization', 'user-agent', 'cf-connecting-ip', 'x-real-ip']) {
      const v = req.headers.get(name)
      if (v) headers.set(name, v)
    }
    headers.set('content-type', 'application/json')
    return {
      kind: 'forward',
      request: new Request(`${url.origin}${VERIFY_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: code }),
      }),
    }
  }

  return null
}
