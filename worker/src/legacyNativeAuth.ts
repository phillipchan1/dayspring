import { NATIVE_APP_ORIGINS } from './cors.ts'
import type { ClaimDb } from './nativeAuth.ts'

async function sha256Hex(input: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

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
 * Without an app release we steer them onto the current native flow, bound
 * server-side so an attacker cannot push their own account into a victim's
 * app through a crafted dayspring://auth-callback?code= link:
 *  1. POST /sign-in/social with the legacy callbackURL from the Tauri webview
 *     → mint a 128-bit nonce, store `legacy-start:<sha256(nonce)>` = ipHash of
 *     that webview request (5 min), answer with
 *     /api/auth/native/start?provider=…&legacy=<nonce>. No webview state.
 *  2. native/start passes `legacy` to finish (like `device`). Finish consumes
 *     the legacy-start row and stores `legacy-code:<sha256(one-time token)>` =
 *     the same ipHash (3 min), then 302s to dayspring://auth-callback/?code=.
 *  3. A state-less GET /callback/{google,apple}?code= from the webview is
 *     forwarded to POST /one-time-token/verify ONLY if an atomic
 *     DELETE … RETURNING of `legacy-code:<sha256(code)>` succeeds and the
 *     ipHash matches. Anything else falls through to Better Auth, which fails a
 *     state-less callback with state_not_found. Real provider callbacks always
 *     carry state and are never touched.
 */
export const LEGACY_NATIVE_CALLBACK_URL = 'https://dayspring-eosin.vercel.app/auth/callback'
export const LEGACY_START_PREFIX = 'legacy-start:'
export const LEGACY_CODE_PREFIX = 'legacy-code:'
export const LEGACY_START_TTL_MS = 5 * 60_000
export const LEGACY_CODE_TTL_MS = 3 * 60_000
/** 128-bit hex nonce on native/start → finish. */
const LEGACY_NONCE = /^[0-9a-f]{32}$/

const LEGACY_PROVIDERS = new Set(['google', 'apple'])
const SOCIAL_SIGN_IN_PATH = '/api/auth/sign-in/social'
const CALLBACK_PATH = /^\/api\/auth\/callback\/(google|apple)\/?$/
const VERIFY_PATH = '/api/auth/one-time-token/verify'

export type LegacyNativeAuth =
  | { kind: 'respond'; response: Response }
  | { kind: 'forward'; request: Request }
  | null

export function parseLegacyNonce(raw: string | null): string | undefined {
  return raw && LEGACY_NONCE.test(raw) ? raw : undefined
}

function fromNativeWebview(req: Request): boolean {
  return (NATIVE_APP_ORIGINS as readonly string[]).includes(req.headers.get('origin') ?? '')
}

function newNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Bound = { v: 1; ipHash: string }

function parseBound(raw: string | null): Bound | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Bound>
    return parsed?.v === 1 && typeof parsed.ipHash === 'string' ? { v: 1, ipHash: parsed.ipHash } : null
  } catch {
    return null
  }
}

/** Finish (legacy flow): consume the start row and bind the minted code to its ipHash. */
export async function bindLegacyCode(store: ClaimDb, nonce: string, code: string): Promise<boolean> {
  const started = parseBound(await store.deleteReturning(`${LEGACY_START_PREFIX}${await sha256Hex(nonce)}`))
  if (!started) return false
  await store.put(
    `${LEGACY_CODE_PREFIX}${await sha256Hex(code)}`,
    JSON.stringify({ v: 1, ipHash: started.ipHash } satisfies Bound),
    new Date(Date.now() + LEGACY_CODE_TTL_MS),
  )
  return true
}

/** Cheap pre-check so ordinary auth requests never open a SQL client for the shim. */
export function isLegacyNativeCandidate(req: Request): boolean {
  if (!fromNativeWebview(req)) return false
  const { pathname, searchParams } = new URL(req.url)
  if (req.method === 'POST') return pathname === SOCIAL_SIGN_IN_PATH
  return req.method === 'GET' && CALLBACK_PATH.test(pathname) && searchParams.has('code') && !searchParams.has('state')
}

export async function legacyNativeAuth(
  req: Request,
  baseURL: string,
  store?: ClaimDb,
  ip?: string,
): Promise<LegacyNativeAuth> {
  if (!store) return null
  const url = new URL(req.url)

  if (req.method === 'POST' && url.pathname === SOCIAL_SIGN_IN_PATH) {
    if (!fromNativeWebview(req)) return null
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
    const nonce = newNonce()
    await store.put(
      `${LEGACY_START_PREFIX}${await sha256Hex(nonce)}`,
      JSON.stringify({ v: 1, ipHash: await sha256Hex(ip ?? '') } satisfies Bound),
      new Date(Date.now() + LEGACY_START_TTL_MS),
    )
    const params = new URLSearchParams({ provider: body.provider, legacy: nonce })
    const start = `${baseURL.replace(/\/$/, '')}/api/auth/native/start?${params}`
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
    if (!fromNativeWebview(req)) return null
    const bound = parseBound(await store.deleteReturning(`${LEGACY_CODE_PREFIX}${await sha256Hex(code)}`))
    if (!bound || bound.ipHash !== await sha256Hex(ip ?? '')) return null
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
