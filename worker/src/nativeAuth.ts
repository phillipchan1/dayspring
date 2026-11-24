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
 *   GET  /api/auth/native/start?provider=google[&link=<ott>][&device=<pkce>]
 *        [&loopback=http://127.0.0.1:<port>/auth-callback/<state>][&scheme=dayspring]
 *        → sets the state cookie here, 302 to the provider
 *   provider → /api/auth/callback/:id (Better Auth, unchanged)
 *        → session cookie here, 302 to /api/auth/native/finish
 *   GET  /api/auth/native/finish
 *        → one-time token for that session, clears the sheet's cookies.
 *          Mac (RFC 8252): HTML that POSTs the one-time token to the loopback
 *          URL on this machine (token stays out of Safari history) and shows a
 *          short confirm code. A hashed claim
 *          is stored under the PKCE challenge as a fallback the app polls
 *          with POST /api/auth/native/claim { verifier, confirm }.
 *          iOS: 302 to {scheme}://auth-callback?code=<ott>
 *
 * The app POSTs the token to /api/auth/one-time-token/verify, which answers
 * with the signed bearer (`set-auth-token`).
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
 * linkSocial knows who is linking. A `device` query on a link URL is ignored
 * so a third party cannot plant their PKCE challenge on someone else's link.
 */
import type { AuthInstance } from './auth.ts'
import type { Sql } from './db.ts'

export const NATIVE_START_PATH = '/api/auth/native/start'
export const NATIVE_FINISH_PATH = '/api/auth/native/finish'
export const NATIVE_CLAIM_PATH = '/api/auth/native/claim'
export const NATIVE_SCHEMES = ['dayspring'] as const
export type NativeScheme = (typeof NATIVE_SCHEMES)[number]
export const NATIVE_CALLBACK = nativeCallbackUrl('dayspring')
/** 128-bit hex state on `/auth-callback/<state>`. */
export const LOOPBACK_STATE_RE = /^[0-9a-f]{32}$/
export const LOOPBACK_PATH_RE = /^\/auth-callback\/([0-9a-f]{32})$/
/** Matches Better Auth oneTimeToken expiresIn (minutes). */
export const NATIVE_CLAIM_TTL_MS = 3 * 60 * 1000
const CLAIM_PREFIX = 'native-claim:'
const CLAIM_RATE_PREFIX = 'native-claim-rl:'
const DEVICE_RE = /^[A-Za-z0-9_-]{32,128}$/
const CONFIRM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CONFIRM_LENGTH = 6
const CLAIM_RATE_WINDOW_MS = 60_000
const CLAIM_RATE_MAX = 120

const PROVIDERS = new Set(['google', 'apple'])

const NO_STORE = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

export function nativeCallbackUrl(scheme: NativeScheme = 'dayspring'): string {
  return `${scheme}://auth-callback`
}

function isNativeScheme(value: string | null): value is NativeScheme {
  return value === 'dayspring'
}

export function parseNativeDevice(raw: string | null): string | undefined {
  if (!raw || !DEVICE_RE.test(raw)) return undefined
  return raw
}

export function parseNativeScheme(raw: string | null): NativeScheme {
  return isNativeScheme(raw) ? raw : 'dayspring'
}

/**
 * RFC 8252 loopback redirect. Only
 * `http://127.0.0.1:<unprivileged>/auth-callback/<32-hex-state>`.
 * No userinfo, query, hash, HTTPS, or `localhost` (DNS rebinding).
 */
export function parseLoopbackRedirect(raw: string | null): string | undefined {
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:') return undefined
  if (url.hostname !== '127.0.0.1') return undefined
  if (url.username || url.password) return undefined
  if (url.search || url.hash) return undefined
  const state = LOOPBACK_PATH_RE.exec(url.pathname)?.[1]
  if (!state || !LOOPBACK_STATE_RE.test(state)) return undefined
  const port = Number(url.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return undefined
  return `http://127.0.0.1:${port}/auth-callback/${state}`
}

export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return ''
}

function hasAuthCookies(req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? ''
  return /better-auth\.(state|session)/i.test(cookie)
}

function redirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: location, ...NO_STORE })
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

function json(status: number, body: unknown, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...NO_STORE, ...extra },
  })
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Bytes(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)))
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = await sha256Bytes(input)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

export async function sha256Base64(input: string): Promise<string> {
  const bytes = await sha256Bytes(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return bytesToB64Url(await sha256Bytes(verifier))
}

function generateConfirmCode(): string {
  const bytes = new Uint8Array(CONFIRM_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += CONFIRM_ALPHABET[b % CONFIRM_ALPHABET.length]
  return out
}

export function normalizeConfirmCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.toUpperCase().replace(/[^A-Z2-9]/g, '')
  if (cleaned.length !== CONFIRM_LENGTH) return undefined
  if ([...cleaned].some((ch) => !CONFIRM_ALPHABET.includes(ch))) return undefined
  return cleaned
}

function jsonForScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export type ClaimPayload = {
  v: 1
  sessionId?: string
  ipHash: string
  confirmHash: string
  error?: string
}

export type ClaimDb = {
  deleteReturning(identifier: string): Promise<string | null>
  peek(identifier: string): Promise<string | null>
  put(identifier: string, value: string, expiresAt: Date): Promise<void>
  sessionToken(sessionId: string): Promise<string | null>
  sessionIdByToken(token: string): Promise<string | null>
  touchRate(key: string, windowMs: number, max: number): Promise<boolean>
}

export function claimDbFromSql(sql: Sql): ClaimDb {
  return {
    async deleteReturning(identifier) {
      const rows = await sql<{ value: string }[]>`
        DELETE FROM verification
        WHERE identifier = ${identifier} AND expires_at > now()
        RETURNING value
      `
      return rows[0]?.value ?? null
    },
    async peek(identifier) {
      const rows = await sql<{ value: string }[]>`
        SELECT value FROM verification
        WHERE identifier = ${identifier} AND expires_at > now()
        ORDER BY expires_at DESC
        LIMIT 1
      `
      return rows[0]?.value ?? null
    },
    async put(identifier, value, expiresAt) {
      await sql`DELETE FROM verification WHERE identifier = ${identifier}`
      await sql`
        INSERT INTO verification (id, identifier, value, expires_at)
        VALUES (${crypto.randomUUID()}, ${identifier}, ${value}, ${expiresAt})
      `
    },
    async sessionToken(sessionId) {
      const rows = await sql<{ token: string }[]>`
        SELECT token FROM session
        WHERE id = ${sessionId} AND expires_at > now()
        LIMIT 1
      `
      return rows[0]?.token ?? null
    },
    async sessionIdByToken(token) {
      const rows = await sql<{ id: string }[]>`
        SELECT id FROM session
        WHERE (token = ${token} OR token = ${token.split('.')[0] ?? token}) AND expires_at > now()
        LIMIT 1
      `
      return rows[0]?.id ?? null
    },
    async touchRate(key, windowMs, max) {
      const now = String(Date.now())
      const window = String(windowMs)
      try {
        const rows = await sql<{ count: number }[]>`
          INSERT INTO rate_limit (id, key, count, last_request)
          VALUES (${crypto.randomUUID()}, ${key}, 1, ${now}::bigint)
          ON CONFLICT (key) DO UPDATE SET
            count = CASE
              WHEN ${now}::bigint - rate_limit.last_request > ${window}::bigint THEN 1
              ELSE rate_limit.count + 1
            END,
            last_request = CASE
              WHEN ${now}::bigint - rate_limit.last_request > ${window}::bigint THEN ${now}::bigint
              ELSE rate_limit.last_request
            END
          RETURNING count
        `
        return Number(rows[0]?.count ?? 1) <= max
      } catch {
        console.warn('[auth] rate_limit unavailable; allowing request')
        return true
      }
    },
  }
}

function parseClaimPayload(raw: string | null): ClaimPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ClaimPayload
    if (parsed?.v !== 1 || typeof parsed.ipHash !== 'string' || typeof parsed.confirmHash !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function putClaim(store: ClaimDb, device: string, payload: ClaimPayload): Promise<void> {
  await store.put(
    CLAIM_PREFIX + device,
    JSON.stringify(payload),
    new Date(Date.now() + NATIVE_CLAIM_TTL_MS),
  )
}

async function signSessionCookieValue(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
  let bin = ''
  for (const b of new Uint8Array(signature)) bin += String.fromCharCode(b)
  return encodeURIComponent(`${token}.${btoa(bin)}`)
}

async function mintOttForSession(
  auth: AuthInstance,
  store: ClaimDb,
  sessionId: string,
): Promise<string | undefined> {
  const token = await store.sessionToken(sessionId)
  if (!token) return undefined
  const ctx = await auth.$context
  const name = (ctx as { authCookies?: { sessionToken?: { name?: string } }; secret?: string }).authCookies?.sessionToken?.name
    ?? 'better-auth.session_token'
  const secret = (ctx as { secret?: string }).secret
  if (!secret) return undefined
  const signed = await signSessionCookieValue(token, secret)
  const minted = await auth.api.generateOneTimeToken({
    headers: new Headers({ cookie: `${name}=${signed}` }),
    asResponse: true,
  })
  if (!minted.ok) return undefined
  const body = (await minted.json().catch(() => null)) as { token?: string } | null
  return body?.token
}

function sessionTokenFromCookie(req: Request): string | undefined {
  const header = req.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    const value = decodeURIComponent(part.slice(eq + 1).trim())
    if (name.includes('better-auth.session_token') && value) return value
  }
  return undefined
}

async function currentSessionId(
  auth: AuthInstance,
  req: Request,
  store?: ClaimDb,
): Promise<string | undefined> {
  const cookieToken = sessionTokenFromCookie(req)
  if (cookieToken && store) {
    const id = await store.sessionIdByToken(cookieToken)
    if (id) return id
  }
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    return session?.session?.id
  } catch {
    return undefined
  }
}

function finishScript(callbackUrl: string): string {
  return `(function(){var href=${jsonForScript(callbackUrl)};try{location.replace(href)}catch(e){}setTimeout(function(){var el=document.getElementById('return');if(el)el.removeAttribute('hidden')},2000)})()`
}

function finishFormScript(): string {
  return `(function(){var f=document.getElementById('f');try{if(f)f.submit()}catch(e){}setTimeout(function(){var el=document.getElementById('return');if(el)el.removeAttribute('hidden')},2000)})()`
}

function loopbackFormActionOrigin(action: string): string | undefined {
  try {
    const url = new URL(action)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') return undefined
    const port = url.port ? `:${url.port}` : ''
    return `http://127.0.0.1${port}`
  } catch {
    return undefined
  }
}

export async function nativeFinishHtml(opts: {
  callbackUrl?: string
  /** POST the token to loopback so it never lands in Safari's URL/history. */
  loopbackPost?: { action: string; fields: Record<string, string> }
  confirm?: string
  heading?: string
}): Promise<{ html: string; csp: string; script: string }> {
  const heading = opts.heading ?? (opts.confirm ? 'Return to Dayspring' : 'Sign-in didn’t finish')
  const confirmBlock = opts.confirm
    ? `<p class="code" aria-label="Sign-in code">${opts.confirm}</p><p class="hint">Type this code in Dayspring if the app doesn’t come back on its own.</p>`
    : `<p class="hint">You can close this window and try again from Dayspring.</p>`
  const loopbackOrigin = opts.loopbackPost
    ? loopbackFormActionOrigin(opts.loopbackPost.action)
    : undefined
  const formAction = opts.loopbackPost && loopbackOrigin ? opts.loopbackPost.action : undefined
  const fields = formAction && opts.loopbackPost
    ? Object.entries(opts.loopbackPost.fields)
      .map(([name, value]) => `<input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(value)}">`)
      .join('')
    : ''
  const href = formAction
    ? `<form id="f" method="POST" action="${escapeAttr(formAction)}">${fields}<p><button type="submit" id="return" hidden>Return to Dayspring</button></p></form>`
    : opts.callbackUrl
      ? `<p><a id="return" hidden href="${escapeAttr(opts.callbackUrl)}">Return to Dayspring</a></p>`
      : ''
  const script = formAction
    ? finishFormScript()
    : opts.callbackUrl
      ? finishScript(opts.callbackUrl)
      : ''
  const scriptTag = script ? `<script>${script}</script>` : ''
  const scriptSrc = script ? `'sha256-${await sha256Base64(script)}'` : "'none'"
  const formActionCsp = loopbackOrigin ? loopbackOrigin : "'none'"
  const csp = `default-src 'none'; base-uri 'none'; form-action ${formActionCsp}; frame-ancestors 'none'; script-src ${scriptSrc}; style-src 'unsafe-inline'`
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Dayspring</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.45 ui-sans-serif, system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f1e8; color: #2b241c; }
  main { max-width: 22rem; padding: 2rem 1.25rem; text-align: center; }
  h1 { font-size: 1.15rem; font-weight: 600; margin: 0 0 .75rem; }
  .code { font: 600 1.75rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .28em; margin: 0 0 .75rem; }
  .hint { color: #6b6258; font-size: .9rem; margin: 0 0 1.25rem; }
  a, button { color: #6b4f2a; }
  a[hidden], button[hidden] { display: none; }
  button { background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-decoration: underline; }
</style>
</head><body><main>
<h1>${escapeText(heading)}</h1>
${confirmBlock}
${href}
${scriptTag}
</main></body></html>`
  return { html, csp, script }
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

function htmlResponse(page: { html: string; csp: string }, setCookies: string[] = []): Response {
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'Content-Security-Policy': page.csp,
    ...NO_STORE,
  })
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie)
  return new Response(page.html, { status: 200, headers })
}

/** Expire Better Auth session cookies in the sheet. Leaves the session row so a later claim can mint a fresh one-time token. */
function expireSessionCookies(req: Request): string[] {
  const header = req.headers.get('cookie') ?? ''
  const names = header
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => name.includes('better-auth.session') || name.includes('better-auth.dont_remember'))
  return names.map((name) => `${name}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`)
}

function setCookiesOf(res: Response): string[] {
  return res.headers.getSetCookie?.() ?? []
}

function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((line) => line.split(';')[0]?.trim() ?? '')
    .filter((pair) => pair.includes('=') && !pair.endsWith('='))
    .join('; ')
}

function backToApp(
  scheme: NativeScheme,
  params: Record<string, string>,
  setCookies: string[] = [],
  webOrigin?: string,
): Response {
  if (webOrigin) {
    const web: Record<string, string> = {}
    if (params.code) web.auth_code = params.code
    if (params.error) web.auth_error = params.error
    return redirect(`${webOrigin}/?${new URLSearchParams(web).toString()}`, setCookies)
  }
  const url = new URL(nativeCallbackUrl(scheme))
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return redirect(url.href, setCookies)
}

function webReturnParam(raw: string | null, allow: readonly string[]): string | undefined | null {
  if (raw === null) return undefined
  return allow.includes(raw) ? raw : null
}

export async function nativeStart(
  auth: AuthInstance,
  req: Request,
  baseURL: string,
  webOrigins: readonly string[] = [],
): Promise<Response> {
  const url = new URL(req.url)
  const web = webReturnParam(url.searchParams.get('return'), webOrigins)
  if (web === null) return new Response('Unknown return origin', { status: 400, headers: NO_STORE })
  const provider = url.searchParams.get('provider') ?? ''
  const scheme = parseNativeScheme(url.searchParams.get('scheme'))
  if (!PROVIDERS.has(provider)) return backToApp(scheme, { error: 'unsupported_provider' }, [], web)
  const typedProvider = provider as 'google' | 'apple'
  if (web && url.searchParams.get('hop') !== '1') {
    url.searchParams.set('hop', '1')
    return redirect(`${baseURL}${NATIVE_START_PATH}?${url.searchParams.toString()}`)
  }
  const finishParams = new URLSearchParams()
  if (web) finishParams.set('return', web)
  const linkToken = url.searchParams.get('link')
  // A device challenge on a link URL is ignored so a third party cannot plant
  // their PKCE challenge on someone else's in-progress link.
  const device = linkToken ? undefined : parseNativeDevice(url.searchParams.get('device'))
  if (device) finishParams.set('device', device)
  const loopback = parseLoopbackRedirect(url.searchParams.get('loopback'))
  if (loopback) finishParams.set('loopback', loopback)
  if (scheme !== 'dayspring') finishParams.set('scheme', scheme)
  const finish = `${baseURL}${NATIVE_FINISH_PATH}${finishParams.toString() ? `?${finishParams}` : ''}`

  let sessionCookies: string[] = []
  let res: Response
  try {
    if (linkToken) {
      const verified = await auth.api.verifyOneTimeToken({ body: { token: linkToken }, asResponse: true })
      if (!verified.ok) return backToApp(scheme, { error: 'link_expired' }, [], web)
      sessionCookies = setCookiesOf(verified)
      const cookie = cookieHeaderFrom(sessionCookies)
      if (!cookie) return backToApp(scheme, { error: 'link_expired' }, [], web)
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
    return backToApp(scheme, { error: 'sign_in_unavailable' }, [], web)
  }
  if (!res.ok) return backToApp(scheme, { error: 'sign_in_unavailable' }, [], web)
  const body = await res.json().catch(() => null) as { url?: string } | null
  if (!body?.url) return backToApp(scheme, { error: 'sign_in_unavailable' }, [], web)
  return redirect(body.url, [...sessionCookies, ...setCookiesOf(res)])
}

export async function nativeFinish(
  auth: AuthInstance,
  req: Request,
  webOrigins: readonly string[] = [],
  store?: ClaimDb,
  ip?: string,
): Promise<Response> {
  const url = new URL(req.url)
  const web = webReturnParam(url.searchParams.get('return'), webOrigins) ?? undefined
  const scheme = parseNativeScheme(url.searchParams.get('scheme'))
  const loopback = parseLoopbackRedirect(url.searchParams.get('loopback'))
  const device = parseNativeDevice(url.searchParams.get('device'))
  const errorParam = url.searchParams.get('error')
  const cookiesOk = hasAuthCookies(req)
  const clear = expireSessionCookies(req)
  const ipHash = await sha256Hex(ip ?? '')
  const confirm = generateConfirmCode()
  const confirmHash = await sha256Hex(confirm)

  // Naked finish?error= (or finish with no cookies) is plantable. Do not
  // redirect to the app or store a claim unless this browser actually started
  // the Better Auth flow.
  if (!cookiesOk) {
    return htmlResponse(await nativeFinishHtml({ heading: 'Sign-in didn’t finish' }))
  }

  const params: Record<string, string> = errorParam ? { error: errorParam } : {}
  let sessionId: string | undefined
  let ott: string | undefined
  if (!errorParam) {
    sessionId = await currentSessionId(auth, req, store)
    try {
      const minted = await auth.api.generateOneTimeToken({ headers: req.headers, asResponse: true })
      if (minted.ok) ott = ((await minted.json()) as { token?: string }).token
    } catch {
      ott = undefined
    }
    if (ott) params.code = ott
    else params.error = 'no_session'
  }

  if (device && store) {
    await putClaim(store, device, {
      v: 1,
      ipHash,
      confirmHash,
      ...(params.code && sessionId ? { sessionId } : {}),
      ...(params.error ? { error: params.error } : {}),
    })
    return htmlResponse(await nativeFinishHtml({
      ...(loopback ? { loopbackPost: { action: loopback, fields: params } } : {}),
      confirm,
      heading: params.error ? 'Sign-in didn’t finish' : 'Return to Dayspring',
    }), clear)
  }

  if (loopback) {
    return htmlResponse(await nativeFinishHtml({
      loopbackPost: { action: loopback, fields: params },
      heading: params.error ? 'Sign-in didn’t finish' : 'Return to Dayspring',
    }), clear)
  }

  if (web) return backToApp(scheme, params, clear, web)
  return backToApp(scheme, params, clear)
}

export async function nativeClaim(
  auth: AuthInstance,
  req: Request,
  cors: Record<string, string> = {},
  store?: ClaimDb,
  ip?: string,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', Allow: 'POST, OPTIONS', ...NO_STORE, ...cors },
    })
  }
  if (!store) return json(503, { error: 'unavailable' }, cors)

  const allowed = await store.touchRate(`${CLAIM_RATE_PREFIX}${await sha256Hex(ip ?? '')}`, CLAIM_RATE_WINDOW_MS, CLAIM_RATE_MAX)
  if (!allowed) return json(429, { error: 'rate_limited' }, cors)

  let body: { verifier?: string; confirm?: string } = {}
  try {
    body = (await req.json()) as { verifier?: string; confirm?: string }
  } catch {
    return json(400, { error: 'invalid_body' }, cors)
  }
  const verifier = parseNativeDevice(body.verifier ?? null)
  if (!verifier) return json(400, { error: 'invalid_verifier' }, cors)

  const challenge = await pkceChallenge(verifier)
  const identifier = CLAIM_PREFIX + challenge
  const confirm = normalizeConfirmCode(body.confirm)

  if (!confirm) {
    const raw = await store.peek(identifier)
    const payload = parseClaimPayload(raw)
    if (!payload) return new Response(null, { status: 204, headers: { ...NO_STORE, ...cors } })
    if (payload.error) return json(200, { error: payload.error }, cors)
    return json(202, { pending: true }, cors)
  }

  const confirmHash = await sha256Hex(confirm)
  const ipHash = await sha256Hex(ip ?? '')
  const raw = await store.peek(identifier)
  const payload = parseClaimPayload(raw)
  if (!payload) return new Response(null, { status: 204, headers: { ...NO_STORE, ...cors } })
  if (payload.confirmHash !== confirmHash) return json(401, { error: 'invalid_confirm' }, cors)
  if (payload.ipHash !== ipHash) return json(401, { error: 'ip_mismatch' }, cors)

  const taken = await store.deleteReturning(identifier)
  const consumed = parseClaimPayload(taken)
  if (!consumed) return new Response(null, { status: 204, headers: { ...NO_STORE, ...cors } })
  if (consumed.confirmHash !== confirmHash || consumed.ipHash !== ipHash) {
    return json(401, { error: 'invalid_confirm' }, cors)
  }
  if (consumed.error) return json(200, { error: consumed.error }, cors)
  if (!consumed.sessionId) return json(401, { error: 'missing_session' }, cors)

  const token = await mintOttForSession(auth, store, consumed.sessionId)
  if (!token) return json(401, { error: 'session_expired' }, cors)
  return json(200, { token }, cors)
}
