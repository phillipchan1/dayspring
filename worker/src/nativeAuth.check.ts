// Run: node --experimental-strip-types worker/src/nativeAuth.check.ts
// Proves the native Google / Apple hand-off end to end against real Better
// Auth on PGlite: start (state cookie in the sheet) → provider callback (token
// endpoint stubbed) → finish (one-time token) → app exchange (signed bearer).
// Also linking, single use, and error pass-through.
import { PGlite } from '@electric-sql/pglite'
import { applyNeonSchema } from './isolationDb.ts'
import { createAuth, type AuthDatabase } from './auth.ts'
import { NATIVE_CALLBACK, NATIVE_FINISH_PATH, nativeFinish, nativeStart } from './nativeAuth.ts'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

function commandOf(sql: string): string {
  const verb = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? 'SELECT'
  return ['UPDATE', 'DELETE', 'INSERT', 'SELECT'].includes(verb) ? verb : 'SELECT'
}

function pglitePool(db: PGlite): AuthDatabase {
  const query = async (sql: string, parameters: readonly unknown[]) => {
    const result = await db.query(sql, parameters as unknown[])
    return { command: commandOf(sql), rowCount: result.affectedRows ?? result.rows.length, rows: result.rows }
  }
  return { options: {}, async connect() { return { query, release() {} } }, async end() {} }
}

/** Browser cookie jar: apply Set-Cookie lines, emit a Cookie header. */
class Jar {
  cookies = new Map<string, string>()
  take(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';')
      const eq = pair!.indexOf('=')
      const name = pair!.slice(0, eq).trim()
      const value = pair!.slice(eq + 1).trim()
      const expired = attrs.some((a) => /max-age=0\b/i.test(a.trim())) || value === ''
      if (expired) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  has(fragment: string) {
    return [...this.cookies.keys()].some((k) => k.includes(fragment))
  }
}

const BASE = 'https://api.dayspring.test'
const db = new PGlite()
await applyNeonSchema(db)
const auth = createAuth(
  {
    BETTER_AUTH_URL: BASE,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/dayspring',
    GOOGLE_CLIENT_ID: 'dummy.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'dummy-google-secret',
  },
  pglitePool(db),
)

// Stub Google's token endpoint. The id_token is decoded, not verified, on the
// code flow (it came straight from Google over TLS).
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const idToken = `${b64({ alg: 'none' })}.${b64({
  sub: 'google-sub-1',
  email: 'native@example.test',
  email_verified: true,
  name: 'Native Tester',
  iss: 'https://accounts.google.com',
  aud: 'dummy.apps.googleusercontent.com',
})}.`
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({
      access_token: 'ya29.dummy',
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile',
    }), { headers: { 'content-type': 'application/json' } })
  }
  return realFetch(input, init)
}) as typeof fetch

const appParams = (res: Response) => {
  const loc = res.headers.get('location') ?? ''
  return loc.startsWith(NATIVE_CALLBACK) ? new URL(loc).searchParams : null
}

/** Sheet: start → Google → Better Auth callback → finish. Returns the app redirect. */
async function sheetRoundTrip(startQuery: string): Promise<{ res: Response; jar: Jar }> {
  const jar = new Jar()
  const start = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?${startQuery}`), BASE)
  jar.take(start)
  const providerUrl = new URL(start.headers.get('location') ?? 'about:blank')
  ok(start.status === 302 && providerUrl.host === 'accounts.google.com', `start redirects to Google (${startQuery})`)
  ok(providerUrl.searchParams.get('redirect_uri') === `${BASE}/api/auth/callback/google`, 'redirect_uri is the Worker callback')
  ok(jar.has('state'), 'state cookie lands in the sheet, not the webview')

  const state = providerUrl.searchParams.get('state') ?? ''
  const cb = await auth.handler(new Request(`${BASE}/api/auth/callback/google?code=google-code&state=${encodeURIComponent(state)}`, {
    headers: { cookie: jar.header() },
  }))
  jar.take(cb)
  const cbLoc = cb.headers.get('location') ?? ''
  ok(cb.status === 302 && cbLoc.startsWith(`${BASE}${NATIVE_FINISH_PATH}`), `callback returns to finish (got ${cb.status} ${cbLoc})`)

  const finish = await nativeFinish(auth, new Request(cbLoc || `${BASE}${NATIVE_FINISH_PATH}`, { headers: { cookie: jar.header() } }))
  jar.take(finish)
  return { res: finish, jar }
}

async function exchange(code: string): Promise<Response> {
  return auth.handler(new Request(`${BASE}/api/auth/one-time-token/verify`, {
    method: 'POST',
    // The real caller: the Tauri webview on iOS / macOS.
    headers: { 'content-type': 'application/json', origin: 'tauri://localhost' },
    body: JSON.stringify({ token: code }),
  }))
}

// 0. The bug this replaces: the webview starts the flow (state cookie lands in
//    the webview), the sheet finishes it without that cookie → state_mismatch.
{
  const webviewStart = await auth.api.signInSocial({
    body: { provider: 'google', callbackURL: `${BASE}/auth/callback`, disableRedirect: true },
    asResponse: true,
  })
  const url = new URL(((await webviewStart.json()) as { url: string }).url)
  const cb = await auth.handler(new Request(
    `${BASE}/api/auth/callback/google?code=google-code&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`,
  ))
  const loc = cb.headers.get('location') ?? ''
  ok(/error=state/.test(loc), `old webview-started flow fails in the sheet (got ${loc})`)
}

// 1. Sign-in
const signIn = await sheetRoundTrip('provider=google')
const signInParams = appParams(signIn.res)
const code = signInParams?.get('code') ?? ''
ok(Boolean(code), `finish hands the app a code (got ${signIn.res.headers.get('location')})`)
ok(!signIn.jar.has('session_token'), 'finish clears the session cookie from the sheet')

const verified = await exchange(code)
const bearer = verified.headers.get('set-auth-token') ?? ''
ok(verified.status === 200, `app exchange succeeds (got ${verified.status})`)
ok(bearer.includes('.'), 'app receives a signed bearer')
ok((verified.headers.get('access-control-expose-headers') ?? '').includes('set-auth-token'), 'webview may read set-auth-token')
const body = await verified.json() as { user?: { email?: string }; session?: { expiresAt?: string } }
ok(body.user?.email === 'native@example.test', 'exchange returns the Google user')
const daysLeft = (new Date(body.session?.expiresAt ?? 0).getTime() - Date.now()) / 86_400_000
ok(daysLeft > 364 && daysLeft <= 365, `sessions last a year, like Supabase (got ${daysLeft.toFixed(1)} days)`)

const replay = await exchange(code)
ok(replay.status !== 200, 'one-time token cannot be replayed')

const session = await auth.handler(new Request(`${BASE}/api/auth/get-session`, { headers: { authorization: `Bearer ${bearer}` } }))
const sessionBody = await session.json() as { user?: { email?: string } } | null
ok(sessionBody?.user?.email === 'native@example.test', 'bearer authenticates the app')

// 2. Link (same Google identity onto the signed-in account): mint a ticket with the bearer.
const gen = await auth.handler(new Request(`${BASE}/api/auth/one-time-token/generate`, { headers: { authorization: `Bearer ${bearer}` } }))
const ticket = ((await gen.json()) as { token?: string }).token ?? ''
ok(gen.status === 200 && Boolean(ticket), 'app can mint a link ticket with its bearer')
const link = await sheetRoundTrip(`provider=google&link=${encodeURIComponent(ticket)}`)
ok(Boolean(appParams(link.res)?.get('code')), `link round-trip returns to the app (got ${link.res.headers.get('location')})`)

const badLink = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&link=nope`), BASE)
ok(appParams(badLink)?.get('error') === 'link_expired', 'bad link ticket returns an error to the app')

// 3. Errors pass through to the app instead of stranding the sheet.
const denied = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}?error=access_denied`))
ok(appParams(denied)?.get('error') === 'access_denied', 'provider error reaches the app')
const noSession = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}`))
ok(appParams(noSession)?.get('error') === 'no_session', 'finish without a session reaches the app as an error')
const badProvider = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=github`), BASE)
ok(appParams(badProvider)?.get('error') === 'unsupported_provider', 'unknown provider is refused')

globalThis.fetch = realFetch
console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('native auth: ok')
