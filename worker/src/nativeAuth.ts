/**
 * Google / Apple sign-in for the native apps (iOS ASWebAuthenticationSession,
 * Mac system browser).
 *
 * Better Auth's social flow keeps two things in the BROWSER that runs it: the
 * signed `state` cookie (checked on the provider callback) and the session
 * cookie it sets afterwards. The app's webview is a different cookie jar from
 * the sign-in sheet, so starting the flow with a webview POST and finishing it
 * in the sheet fails with `state_mismatch`, and even a passing callback would
 * leave the session in the sheet with nothing for the app to exchange.
 *
 * So the whole round-trip runs in the sheet:
 *
 *   GET  /api/auth/native/start?provider=google[&link=<ott>]
 *        → sets the state cookie here, 302 to the provider
 *   provider → /api/auth/callback/:id (Better Auth, unchanged)
 *        → session cookie here, 302 to /api/auth/native/finish
 *   GET  /api/auth/native/finish
 *        → one-time token for that session, clears the sheet's cookies,
 *          302 to dayspring://auth-callback?code=<ott>
 *
 * The app then POSTs the token to /api/auth/one-time-token/verify, which
 * answers with the signed bearer (`set-auth-token`).
 *
 * Linking a second provider: the app first mints a one-time token with its
 * bearer (GET /api/auth/one-time-token/generate) and passes it as `link`.
 * `start` turns it into a session cookie in the sheet so Better Auth's
 * linkSocial knows who is linking.
 */
import type { AuthInstance } from './auth.ts'

export const NATIVE_START_PATH = '/api/auth/native/start'
export const NATIVE_FINISH_PATH = '/api/auth/native/finish'
export const NATIVE_CALLBACK = 'dayspring://auth-callback'

const PROVIDERS = new Set(['google', 'apple'])

const NO_STORE = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

function redirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: location, ...NO_STORE })
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

function backToApp(params: Record<string, string>, setCookies: string[] = []): Response {
  return redirect(`${NATIVE_CALLBACK}?${new URLSearchParams(params).toString()}`, setCookies)
}

function setCookiesOf(res: Response): string[] {
  return res.headers.getSetCookie?.() ?? []
}

/** `name=value` pairs from Set-Cookie lines, for a Cookie request header. */
function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((line) => line.split(';')[0]?.trim() ?? '')
    .filter((pair) => pair.includes('=') && !pair.endsWith('='))
    .join('; ')
}

/** Expire every Better Auth session cookie the sheet sent us. */
function expireSessionCookies(req: Request): string[] {
  const header = req.headers.get('cookie') ?? ''
  const names = header
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => name.includes('better-auth.session') || name.includes('better-auth.dont_remember'))
  return names.map((name) => `${name}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`)
}

export async function nativeStart(auth: AuthInstance, req: Request, baseURL: string): Promise<Response> {
  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') ?? ''
  if (!PROVIDERS.has(provider)) return backToApp({ error: 'unsupported_provider' })
  const typedProvider = provider as 'google' | 'apple'
  const finish = `${baseURL}${NATIVE_FINISH_PATH}`
  const linkToken = url.searchParams.get('link')

  let sessionCookies: string[] = []
  let res: Response
  try {
    if (linkToken) {
      const verified = await auth.api.verifyOneTimeToken({ body: { token: linkToken }, asResponse: true })
      if (!verified.ok) return backToApp({ error: 'link_expired' })
      sessionCookies = setCookiesOf(verified)
      const cookie = cookieHeaderFrom(sessionCookies)
      if (!cookie) return backToApp({ error: 'link_expired' })
      res = await auth.api.linkSocialAccount({
        body: { provider: typedProvider, callbackURL: finish, errorCallbackURL: finish, disableRedirect: true },
        headers: new Headers({ cookie }),
        asResponse: true,
      })
    } else {
      res = await auth.api.signInSocial({
        body: { provider: typedProvider, callbackURL: finish, errorCallbackURL: finish, disableRedirect: true },
        asResponse: true,
      })
    }
  } catch {
    return backToApp({ error: 'sign_in_unavailable' })
  }
  if (!res.ok) return backToApp({ error: 'sign_in_unavailable' })
  const body = await res.json().catch(() => null) as { url?: string } | null
  if (!body?.url) return backToApp({ error: 'sign_in_unavailable' })
  return redirect(body.url, [...sessionCookies, ...setCookiesOf(res)])
}

export async function nativeFinish(auth: AuthInstance, req: Request): Promise<Response> {
  const url = new URL(req.url)
  const clear = expireSessionCookies(req)
  const error = url.searchParams.get('error')
  if (error) return backToApp({ error }, clear)
  let token: string | undefined
  try {
    const res = await auth.api.generateOneTimeToken({ headers: req.headers, asResponse: true })
    if (res.ok) token = ((await res.json()) as { token?: string }).token
  } catch {
    token = undefined
  }
  if (!token) return backToApp({ error: 'no_session' }, clear)
  return backToApp({ code: token }, clear)
}
