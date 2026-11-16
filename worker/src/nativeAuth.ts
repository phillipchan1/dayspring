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
 * Web uses the same flow with `return=<web origin>`: the browser itself is the
 * sheet. Because dayspring-eosin.vercel.app is a proxy, start first hops to the
 * canonical auth origin so the state cookie lands where the provider returns,
 * and finish sends the browser back to `<return>/?auth_code=<ott>` (or
 * `?auth_error=`). `return` must be an allowlisted web origin.
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

function backToApp(params: Record<string, string>, setCookies: string[] = [], webOrigin?: string): Response {
  if (webOrigin) {
    const web: Record<string, string> = {}
    if (params.code) web.auth_code = params.code
    if (params.error) web.auth_error = params.error
    return redirect(`${webOrigin}/?${new URLSearchParams(web).toString()}`, setCookies)
  }
  return redirect(`${NATIVE_CALLBACK}?${new URLSearchParams(params).toString()}`, setCookies)
}

/** The allowlisted web origin a flow should return to, or undefined (native). */
function webReturn(url: URL, webOrigins: readonly string[]): string | undefined | null {
  const raw = url.searchParams.get('return')
  if (raw === null) return undefined
  return webOrigins.includes(raw) ? raw : null
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

export async function nativeStart(
  auth: AuthInstance,
  req: Request,
  baseURL: string,
  webOrigins: readonly string[] = [],
): Promise<Response> {
  const url = new URL(req.url)
  const web = webReturn(url, webOrigins)
  if (web === null) return new Response('Unknown return origin', { status: 400, headers: NO_STORE })
  const provider = url.searchParams.get('provider') ?? ''
  if (!PROVIDERS.has(provider)) return backToApp({ error: 'unsupported_provider' }, [], web)
  const typedProvider = provider as 'google' | 'apple'
  if (web && url.searchParams.get('hop') !== '1') {
    // Arrived through a proxy origin (or any other): continue on the canonical
    // auth origin so the state cookie is set where the provider returns.
    url.searchParams.set('hop', '1')
    return redirect(`${baseURL}${NATIVE_START_PATH}?${url.searchParams.toString()}`)
  }
  const finish = `${baseURL}${NATIVE_FINISH_PATH}${web ? `?${new URLSearchParams({ return: web })}` : ''}`
  const linkToken = url.searchParams.get('link')

  let sessionCookies: string[] = []
  let res: Response
  try {
    if (linkToken) {
      const verified = await auth.api.verifyOneTimeToken({ body: { token: linkToken }, asResponse: true })
      if (!verified.ok) return backToApp({ error: 'link_expired' }, [], web)
      sessionCookies = setCookiesOf(verified)
      const cookie = cookieHeaderFrom(sessionCookies)
      if (!cookie) return backToApp({ error: 'link_expired' }, [], web)
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
    return backToApp({ error: 'sign_in_unavailable' }, [], web)
  }
  if (!res.ok) return backToApp({ error: 'sign_in_unavailable' }, [], web)
  const body = await res.json().catch(() => null) as { url?: string } | null
  if (!body?.url) return backToApp({ error: 'sign_in_unavailable' }, [], web)
  return redirect(body.url, [...sessionCookies, ...setCookiesOf(res)])
}

export async function nativeFinish(
  auth: AuthInstance,
  req: Request,
  webOrigins: readonly string[] = [],
): Promise<Response> {
  const url = new URL(req.url)
  const web = webReturn(url, webOrigins) ?? undefined
  const clear = expireSessionCookies(req)
  const error = url.searchParams.get('error')
  if (error) return backToApp({ error }, clear, web)
  let token: string | undefined
  try {
    const res = await auth.api.generateOneTimeToken({ headers: req.headers, asResponse: true })
    if (res.ok) token = ((await res.json()) as { token?: string }).token
  } catch {
    token = undefined
  }
  if (!token) return backToApp({ error: 'no_session' }, clear, web)
  return backToApp({ code: token }, clear, web)
}
