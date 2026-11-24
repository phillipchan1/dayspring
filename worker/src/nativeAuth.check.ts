// Run: node --experimental-strip-types worker/src/nativeAuth.check.ts
// Proves the native Google / Apple hand-off end to end against real Better
// Auth on PGlite: start (state cookie in the sheet) → provider callback (token
// endpoint stubbed) → finish (one-time token) → app exchange (signed bearer).
// Also linking, single use, and error pass-through.
import { PGlite } from '@electric-sql/pglite'
import { applyNeonSchema } from './isolationDb.ts'
import { createAuth, type AuthDatabase } from './auth.ts'
import {
  NATIVE_CALLBACK,
  NATIVE_CLAIM_PATH,
  NATIVE_FINISH_PATH,
  nativeCallbackUrl,
  nativeClaim,
  nativeFinish,
  nativeFinishHtml,
  nativeStart,
  parseLoopbackRedirect,
  pkceChallenge,
  type ClaimDb,
} from './nativeAuth.ts'
import { LEGACY_NATIVE_CALLBACK_URL, isLegacyNativeCandidate, legacyNativeAuth } from './legacyNativeAuth.ts'

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

function pgliteClaimDb(db: PGlite): ClaimDb {
  return {
    async deleteReturning(identifier) {
      const result = await db.query<{ value: string }>(
        'DELETE FROM verification WHERE identifier = $1 AND expires_at > now() RETURNING value',
        [identifier],
      )
      return result.rows[0]?.value ?? null
    },
    async peek(identifier) {
      const result = await db.query<{ value: string }>(
        'SELECT value FROM verification WHERE identifier = $1 AND expires_at > now() ORDER BY expires_at DESC LIMIT 1',
        [identifier],
      )
      return result.rows[0]?.value ?? null
    },
    async put(identifier, value, expiresAt) {
      await db.query('DELETE FROM verification WHERE identifier = $1', [identifier])
      await db.query(
        'INSERT INTO verification (id, identifier, value, expires_at) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), identifier, value, expiresAt],
      )
    },
    async sessionToken(sessionId) {
      const result = await db.query<{ token: string }>(
        'SELECT token FROM session WHERE id = $1 AND expires_at > now() LIMIT 1',
        [sessionId],
      )
      return result.rows[0]?.token ?? null
    },
    async sessionIdByToken(token) {
      const result = await db.query<{ id: string }>(
        'SELECT id FROM session WHERE (token = $1 OR token = $2) AND expires_at > now() LIMIT 1',
        [token, token.split('.')[0] ?? token],
      )
      return result.rows[0]?.id ?? null
    },
    async touchRate(key, windowMs, max) {
      const now = String(Date.now())
      const result = await db.query<{ count: number }>(
        `INSERT INTO rate_limit (id, key, count, last_request)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN $3::bigint - rate_limit.last_request > $4::bigint THEN 1 ELSE rate_limit.count + 1 END,
           last_request = CASE WHEN $3::bigint - rate_limit.last_request > $4::bigint THEN $3::bigint ELSE rate_limit.last_request END
         RETURNING count`,
        [crypto.randomUUID(), key, now, String(windowMs)],
      )
      return Number(result.rows[0]?.count ?? 1) <= max
    },
  }
}

const BASE = 'https://api.dayspring.test'
const db = new PGlite()
await applyNeonSchema(db)
const store = pgliteClaimDb(db)
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

  const finish = await nativeFinish(auth, new Request(cbLoc || `${BASE}${NATIVE_FINISH_PATH}`, { headers: { cookie: jar.header() } }), [], store, '203.0.113.10')
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

// 2b. Web: the browser is the sheet, entering through the Vercel proxy origin.
{
  const WEB = 'https://dayspring-eosin.vercel.app'
  const origins = [BASE, WEB]
  const jar = new Jar()
  const first = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&return=${encodeURIComponent(WEB)}`), BASE, origins)
  const hop = first.headers.get('location') ?? ''
  ok(first.status === 302 && hop.startsWith(`${BASE}/api/auth/native/start?`) && hop.includes('hop=1'), `web start hops to the auth origin first (got ${hop})`)
  ok(first.headers.getSetCookie().length === 0, 'the hop sets no cookie on the proxy origin')
  const start = await nativeStart(auth, new Request(hop), BASE, origins)
  jar.take(start)
  const providerUrl = new URL(start.headers.get('location') ?? 'about:blank')
  ok(providerUrl.host === 'accounts.google.com' && jar.has('state'), 'web start sets state on the auth origin and goes to Google')
  const cb = await auth.handler(new Request(`${BASE}/api/auth/callback/google?code=google-code&state=${encodeURIComponent(providerUrl.searchParams.get('state') ?? '')}`, { headers: { cookie: jar.header() } }))
  jar.take(cb)
  const cbLoc = cb.headers.get('location') ?? ''
  ok(cbLoc.startsWith(`${BASE}${NATIVE_FINISH_PATH}?return=`), `web callback returns to finish with its origin (got ${cbLoc})`)
  const finish = await nativeFinish(auth, new Request(cbLoc, { headers: { cookie: jar.header() } }), origins)
  const back = new URL(finish.headers.get('location') ?? 'about:blank')
  ok(back.origin === WEB && Boolean(back.searchParams.get('auth_code')), `web finish returns to the web app with a code (got ${back.href.replace(/auth_code=[^&]+/, 'auth_code=X')})`)
  const webVerified = await auth.handler(new Request(`${BASE}/api/auth/one-time-token/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: WEB },
    body: JSON.stringify({ token: back.searchParams.get('auth_code') }),
  }))
  ok(webVerified.status === 200 && (webVerified.headers.get('set-auth-token') ?? '').includes('.'), 'web page exchanges the code for a bearer')

  const evil = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&return=${encodeURIComponent('https://evil.example')}`), BASE, origins)
  ok(evil.status === 400, 'an unknown return origin is refused')
  const evilFinish = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}?return=${encodeURIComponent('https://evil.example')}&error=x`), origins)
  const evilLoc = evilFinish.headers.get('location') ?? ''
  ok(!evilLoc.includes('evil.example'), `finish never redirects to an unknown origin (got ${evilLoc || 'no location'})`)
  const webErr = await nativeFinish(auth, new Request(cbLoc.replace(/\?.*$/, `?return=${encodeURIComponent(WEB)}&error=access_denied`), { headers: { cookie: jar.header() } }), origins)
  ok(webErr.headers.get('location') === `${WEB}/?auth_error=access_denied`, 'web errors come back as auth_error when the browser started the flow')
}

// 3. Errors pass through to the app instead of stranding the sheet.
{
  const jar = new Jar()
  const start = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google`), BASE)
  jar.take(start)
  const denied = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}?error=access_denied`, { headers: { cookie: jar.header() } }), [], store, '203.0.113.10')
  ok(appParams(denied)?.get('error') === 'access_denied', 'provider error reaches the app when the sheet started the flow')
  const noSession = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}`, { headers: { cookie: jar.header() } }), [], store, '203.0.113.10')
  ok(appParams(noSession)?.get('error') === 'no_session', 'finish without a session reaches the app as an error')
}
const planted = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}?error=access_denied`))
ok(planted.status === 200 && planted.headers.get('location') == null, 'naked finish?error= does not redirect to the app')
ok((await planted.text()).includes('Sign-in didn’t finish'), 'planted finish is a generic page')
const badProvider = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=github`), BASE)
ok(appParams(badProvider)?.get('error') === 'unsupported_provider', 'unknown provider is refused')

function claimPost(body: object, ip = '203.0.113.10') {
  return new Request(`${BASE}${NATIVE_CLAIM_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
      origin: 'tauri://localhost',
    },
    body: JSON.stringify(body),
  })
}

const cors = { 'Access-Control-Allow-Origin': 'tauri://localhost' }

const loopbackState = '0123456789abcdef0123456789abcdef'
const loopback = `http://127.0.0.1:54721/auth-callback/${loopbackState}`
ok(parseLoopbackRedirect(loopback) === loopback, 'loopback 127.0.0.1:ephemeral with state is allowed')
ok(parseLoopbackRedirect('http://127.0.0.1:54721/auth-callback') === undefined, 'loopback without state is refused')
ok(parseLoopbackRedirect('http://127.0.0.1:80/auth-callback/' + loopbackState) === undefined, 'loopback port 80 is refused')
ok(parseLoopbackRedirect('http://localhost:54721/auth-callback/' + loopbackState) === undefined, 'loopback localhost is refused')
ok(parseLoopbackRedirect('http://evil.com@127.0.0.1:54721/auth-callback/' + loopbackState) === undefined, 'loopback userinfo is refused')
ok(parseLoopbackRedirect('https://127.0.0.1:54721/auth-callback/' + loopbackState) === undefined, 'loopback https is refused')
ok(parseLoopbackRedirect(loopback + '?x=1') === undefined, 'loopback extra query is refused')
ok(parseLoopbackRedirect('http://127.0.0.1:54721/auth-callback/ABCDEF0123456789abcdef0123456789') === undefined, 'loopback uppercase state is refused')

// 4. Hardened claim fallback: PKCE + confirm + IP. Loopback HTML, not dayspring://.
{
  const verifier = `v${'A'.repeat(42)}`
  const challenge = await pkceChallenge(verifier)
  const otherVerifier = `v${'B'.repeat(42)}`
  const victimIp = '203.0.113.10'
  const attackerIp = '198.51.100.9'
  const jar = new Jar()
  const start = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&device=${challenge}&loopback=${encodeURIComponent(loopback)}&scheme=dayspring-alpha`), BASE)
  jar.take(start)
  const providerUrl = new URL(start.headers.get('location') ?? 'about:blank')
  const state = providerUrl.searchParams.get('state') ?? ''
  const cb = await auth.handler(new Request(`${BASE}/api/auth/callback/google?code=google-code&state=${encodeURIComponent(state)}`, {
    headers: { cookie: jar.header() },
  }))
  jar.take(cb)
  const cbLoc = cb.headers.get('location') ?? ''
  ok(cbLoc.includes(`device=${challenge}`), `finish URL carries the PKCE challenge (got ${cbLoc})`)
  ok(cbLoc.includes('scheme=dayspring-alpha'), `finish URL carries the alpha scheme (got ${cbLoc})`)
  ok(cbLoc.includes('loopback='), `finish URL carries the loopback (got ${cbLoc})`)

  const empty = await nativeClaim(auth, claimPost({ verifier }), cors, store, victimIp)
  ok(empty.status === 204, `claim is empty before finish (got ${empty.status})`)

  const getClaim = await nativeClaim(auth, new Request(`${BASE}${NATIVE_CLAIM_PATH}?device=${challenge}`), cors, store, victimIp)
  ok(getClaim.status === 405, 'GET /native/claim is refused')

  const finish = await nativeFinish(auth, new Request(cbLoc, { headers: { cookie: jar.header() } }), [], store, victimIp)
  jar.take(finish)
  ok(finish.status === 200, `Mac finish with a device nonce is an HTML page (got ${finish.status})`)
  ok((finish.headers.get('content-type') ?? '').includes('text/html'), 'finish page is HTML, not a 302')
  const csp = finish.headers.get('content-security-policy') ?? ''
  ok(csp.includes("default-src 'none'") && csp.includes('sha256-'), `finish CSP hashes the inline script (got ${csp})`)
  const html = await finish.text()
  ok(html.includes('Return to Dayspring'), 'finish page offers Return to Dayspring')
  ok(html.includes(`action="${loopback}"`) && html.includes('method="POST"'), 'finish page POSTs through loopback, not the custom scheme')
  ok(!html.includes(`${loopback}?`), 'one-time token is not on the 127.0.0.1 URL')
  ok(!html.includes('dayspring-alpha://') && !html.includes('dayspring://auth-callback'), 'finish HTML does not put the one-time token on a custom-scheme URL')
  ok(/setTimeout\(function\(\)\{[\s\S]*\},2000\)/.test(html), 'Return to Dayspring waits about 2s')
  const confirm = html.match(/aria-label="Sign-in code">([A-Z2-9]{6})</)?.[1] ?? ''
  ok(Boolean(confirm), 'finish page shows a confirm code')
  ok(csp.includes('form-action http://127.0.0.1:54721'), 'finish CSP allows the loopback form POST')

  const pending = await nativeClaim(auth, claimPost({ verifier }), cors, store, attackerIp)
  ok(pending.status === 202, `phishing attacker-chosen PKCE challenge cannot claim the victim token without confirm (got ${pending.status})`)
  const pendingBody = await pending.json() as { token?: string; pending?: boolean }
  ok(pendingBody.pending === true && !pendingBody.token, 'pending claim has no token')

  const stolen = await nativeClaim(auth, claimPost({ verifier, confirm }), cors, store, attackerIp)
  ok(stolen.status === 401, 'phishing attacker-chosen PKCE challenge cannot claim the victim token from another IP')
  const stolenBody = await stolen.json() as { token?: string; error?: string }
  ok(!stolenBody.token && stolenBody.error === 'ip_mismatch', 'cross-IP claim is ip_mismatch, not a token')

  const wrongConfirm = await nativeClaim(auth, claimPost({ verifier, confirm: 'AAAAAA' }), cors, store, victimIp)
  ok(wrongConfirm.status === 401, 'wrong confirm code is refused')

  const wrongVerifier = await nativeClaim(auth, claimPost({ verifier: otherVerifier, confirm }), cors, store, victimIp)
  ok(wrongVerifier.status === 204, 'a different PKCE verifier cannot take the claim')

  const claimed = await nativeClaim(auth, claimPost({ verifier, confirm }), cors, store, victimIp)
  const claimedPreview = claimed.status === 200 ? '' : ` ${await claimed.clone().text()}`
  ok(claimed.status === 200, `claim returns the token (got ${claimed.status}${claimedPreview})`)
  ok(claimed.headers.get('access-control-allow-origin') === 'tauri://localhost', 'claim echoes the native origin')
  const claimedBody = await claimed.json() as { token?: string; error?: string }
  ok(Boolean(claimedBody.token), 'claim body has a token, not an error')
  ok(!JSON.stringify(claimedBody).includes(confirm), 'claim response does not echo the confirm code')
  const viaClaim = await exchange(claimedBody.token ?? '')
  ok(viaClaim.status === 200 && (viaClaim.headers.get('set-auth-token') ?? '').includes('.'), 'app can verify a claimed token')

  const replayClaim = await nativeClaim(auth, claimPost({ verifier, confirm }), cors, store, victimIp)
  ok(replayClaim.status === 204, 'claim is single-use')

  const missing = await nativeClaim(auth, claimPost({}), cors, store, victimIp)
  ok(missing.status === 400, 'claim without a verifier is refused')
  const short = await nativeClaim(auth, claimPost({ verifier: 'short' }), cors, store, victimIp)
  ok(short.status === 400, 'a too-short verifier is refused')
}

{
  const verifier = `n${'E'.repeat(42)}`
  const challenge = await pkceChallenge(verifier)
  const jar = new Jar()
  const start = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&device=${challenge}`), BASE)
  jar.take(start)
  const providerUrl = new URL(start.headers.get('location') ?? 'about:blank')
  const oauthState = providerUrl.searchParams.get('state') ?? ''
  const cb = await auth.handler(new Request(`${BASE}/api/auth/callback/google?code=google-code&state=${encodeURIComponent(oauthState)}`, {
    headers: { cookie: jar.header() },
  }))
  jar.take(cb)
  const finish = await nativeFinish(auth, new Request(cb.headers.get('location') ?? `${BASE}${NATIVE_FINISH_PATH}`, { headers: { cookie: jar.header() } }), [], store, '203.0.113.10')
  const html = await finish.text()
  const confirm = html.match(/aria-label="Sign-in code">([A-Z2-9]{6})</)?.[1] ?? ''
  const [first, second] = await Promise.all([
    nativeClaim(auth, claimPost({ verifier, confirm }), cors, store, '203.0.113.10'),
    nativeClaim(auth, claimPost({ verifier, confirm }), cors, store, '203.0.113.10'),
  ])
  const statuses = [first.status, second.status].sort((a, b) => a - b)
  ok(statuses[0] === 200 && statuses[1] === 204, `concurrent claim consume is atomic (got ${first.status} and ${second.status})`)
  const bodies = [first, second].filter((res) => res.status === 200)
  ok(bodies.length === 1, 'only one concurrent claim returns a token')
}

{
  const verifier = `e${'C'.repeat(42)}`
  const challenge = await pkceChallenge(verifier)
  const jar = new Jar()
  const start = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&device=${challenge}`), BASE)
  jar.take(start)
  const denied = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}?error=access_denied&device=${challenge}`, { headers: { cookie: jar.header() } }), [], store, '203.0.113.10')
  ok(denied.status === 200 && (await denied.clone().text()).includes('Sign-in didn’t finish'), 'error finish with a device is still an HTML page')
  const claimed = await nativeClaim(auth, claimPost({ verifier }), cors, store, '203.0.113.10')
  ok(claimed.status === 200, 'claim returns a provider error without a confirm code')
  const body = await claimed.json() as { error?: string; token?: string }
  ok(body.error === 'access_denied' && !body.token, 'claim error is bound to that verifier, with no token')
}

{
  const plantedDevice = await pkceChallenge(`p${'D'.repeat(42)}`)
  const plantedError = await nativeFinish(auth, new Request(`${BASE}${NATIVE_FINISH_PATH}?error=access_denied&device=${plantedDevice}`), [], store, '198.51.100.9')
  ok(plantedError.status === 200, 'planted finish?error=&device= is HTML')
  const plantedClaim = await nativeClaim(auth, claimPost({ verifier: `p${'D'.repeat(42)}` }), cors, store, '198.51.100.9')
  ok(plantedClaim.status === 204, 'planted finish?error= cannot store a claim')
}

{
  const ticketStart = await nativeStart(auth, new Request(`${BASE}/api/auth/native/start?provider=google&link=not-a-token&device=${'Z'.repeat(43)}`), BASE)
  // bad link still errors; the device must not be copied onto finish
  ok(appParams(ticketStart)?.get('error') === 'link_expired', 'bad link ticket returns an error to the app')
}

{
  const page = await nativeFinishHtml({
    callbackUrl: 'dayspring://auth-callback?code=<img>',
    confirm: 'ABC234',
  })
  ok(page.html.includes('Return to Dayspring'), 'finish HTML always includes the return control')
  ok(page.html.includes('\\u003c'), 'finish HTML escapes < in the inline JSON')
  ok(page.csp.includes('sha256-'), 'finish HTML CSP includes the script hash')
  ok(page.html.includes('ABC234'), 'finish HTML shows the confirm code')
  ok(nativeCallbackUrl('dayspring-alpha') === 'dayspring-alpha://auth-callback', 'alpha scheme has its own callback URL')
}

{
  const posted = await nativeFinishHtml({
    loopbackPost: {
      action: loopback,
      fields: { code: '<img src=x onerror=alert(1)>' },
    },
    confirm: 'ABC234',
  })
  ok(posted.html.includes(`action="${loopback}"`), 'loopback form posts to the state path')
  ok(!posted.html.includes(`${loopback}?`), 'loopback form action has no query')
  ok(posted.html.includes('&lt;img') && !posted.html.includes('<img src'), 'loopback form escapes the token in the hidden field')
  ok(posted.csp.includes('form-action http://127.0.0.1:54721'), 'loopback form CSP allows 127.0.0.1')
}

// 6. iOS App Store 1.0.1349 (2c6dd0da) and other pre-native/start builds, with no
//    app release. The webview's POST /sign-in/social is steered to native/start
//    with a legacy nonce bound to the webview's IP; only the code finish minted
//    for that nonce may be exchanged through the state-less GET /callback/apple.
{
  const WEBVIEW_IP = '198.51.100.7'
  const OTHER_IP = '192.0.2.99'
  const TAURI = { origin: 'tauri://localhost' }
  const legacySocial = (body: object, headers: Record<string, string> = TAURI) => new Request(`${BASE}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const legacyCallback = (code: string, headers: Record<string, string> = TAURI, provider = 'apple') =>
    new Request(`${BASE}/api/auth/callback/${provider}?code=${encodeURIComponent(code)}`, { headers })
  /** What index.ts does: forward to Better Auth only when the shim says so. */
  const legacyExchange = async (req: Request, ip: string) => {
    const r = await legacyNativeAuth(req, BASE, store, ip)
    return r?.kind === 'forward' ? auth.handler(r.request) : null
  }
  /** 1.0.1349 sign-in: shim start → sheet round-trip → dayspring://auth-callback?code=. */
  const legacyFlow = async (provider = 'google') => {
    const started = await legacyNativeAuth(legacySocial({ provider, callbackURL: LEGACY_NATIVE_CALLBACK_URL, disableRedirect: true }), BASE, store, WEBVIEW_IP)
    const body = started?.kind === 'respond' ? await started.response.json() as { url?: string; redirect?: boolean } : {}
    const startUrl = new URL(body.url ?? 'about:blank')
    const round = await sheetRoundTrip(startUrl.searchParams.toString())
    return { started, body, startUrl, code: appParams(round.res)?.get('code') ?? '', res: round.res }
  }

  const flow = await legacyFlow()
  ok(flow.started?.kind === 'respond', 'legacy social sign-in is answered by the shim')
  ok(`${flow.startUrl.origin}${flow.startUrl.pathname}` === `${BASE}/api/auth/native/start`, `legacy start URL is native/start (got ${flow.body.url})`)
  ok(flow.startUrl.searchParams.get('provider') === 'google', 'legacy start URL carries the provider')
  ok(/^[0-9a-f]{32}$/.test(flow.startUrl.searchParams.get('legacy') ?? ''), 'legacy start URL carries a 128-bit nonce')
  ok(flow.body.redirect === false, 'legacy start honours disableRedirect')
  ok(Boolean(flow.code), `legacy flow ends at dayspring://auth-callback?code= (got ${flow.res.headers.get('location')})`)
  ok(isLegacyNativeCandidate(legacyCallback(flow.code)), 'index pre-check routes the legacy exchange to the shim')

  // Exactly what 1.0.1349's completeWorkersOAuthCallback does with that URL, from the same webview.
  const good = await legacyExchange(legacyCallback(flow.code), WEBVIEW_IP)
  ok(good?.status === 200, `legacy exchange succeeds (got ${good?.status})`)
  ok((good?.headers.get('set-auth-token') ?? '').includes('.'), 'legacy exchange returns a signed bearer')
  ok(await legacyExchange(legacyCallback(flow.code), WEBVIEW_IP) === null, 'legacy code cannot be replayed through the shim')
  ok((await exchange(flow.code)).status !== 200, 'legacy one-time token is single use')

  // QA2 #223 M1: an attacker-minted OTT (their own bearer → /one-time-token/generate)
  // delivered via dayspring://auth-callback?code= must not log the victim's app in.
  const attackerGen = await auth.handler(new Request(`${BASE}/api/auth/one-time-token/generate`, { headers: { authorization: `Bearer ${bearer}` } }))
  const attackerOtt = ((await attackerGen.json()) as { token?: string }).token ?? ''
  ok(attackerGen.status === 200 && Boolean(attackerOtt), 'attacker can mint an OTT for their own account')
  ok(await legacyExchange(legacyCallback(attackerOtt), WEBVIEW_IP) === null, 'attacker-minted OTT is NOT forwarded (no bearer)')
  const fallthrough = await auth.handler(legacyCallback(attackerOtt))
  ok(!fallthrough.headers.get('set-auth-token') && /error=state_not_found/.test(fallthrough.headers.get('location') ?? ''), `attacker OTT falls through to Better Auth state_not_found (got ${fallthrough.status} ${fallthrough.headers.get('location')})`)

  // A legacy flow the attacker runs themselves is bound to the attacker's IP.
  const otherIp = await legacyFlow()
  ok(Boolean(otherIp.code), 'second legacy flow mints a code')
  ok(await legacyExchange(legacyCallback(otherIp.code), OTHER_IP) === null, 'legacy code from a different IP gets no bearer')
  ok(await legacyExchange(legacyCallback(otherIp.code), WEBVIEW_IP) === null, 'a refused legacy code is burned (no retry from the right IP)')

  // Origin: only the Tauri webview.
  const noOrigin = await legacyFlow()
  ok(await legacyExchange(legacyCallback(noOrigin.code, {}), WEBVIEW_IP) === null, 'legacy exchange without Origin tauri://localhost is refused')
  ok(await legacyExchange(legacyCallback(noOrigin.code, { origin: 'https://evil.example' }), WEBVIEW_IP) === null, 'legacy exchange from a web origin is refused')
  ok(await legacyNativeAuth(legacySocial({ provider: 'google', callbackURL: LEGACY_NATIVE_CALLBACK_URL, disableRedirect: true }, {}), BASE, store, WEBVIEW_IP) === null, 'legacy start without Origin tauri://localhost falls through')

  // A start URL without a valid legacy nonce (or a reused one) never binds a code.
  const forged = await sheetRoundTrip(`provider=google&legacy=${'a'.repeat(32)}`)
  const forgedCode = appParams(forged.res)?.get('code') ?? ''
  ok(Boolean(forgedCode) && await legacyExchange(legacyCallback(forgedCode), WEBVIEW_IP) === null, 'unknown legacy nonce binds nothing')
  const reused = await sheetRoundTrip(flow.startUrl.searchParams.toString())
  const reusedCode = appParams(reused.res)?.get('code') ?? ''
  ok(Boolean(reusedCode) && await legacyExchange(legacyCallback(reusedCode), WEBVIEW_IP) === null, 'a consumed legacy nonce cannot bind a second code')
  const plain = await sheetRoundTrip('provider=google')
  ok(await legacyExchange(legacyCallback(appParams(plain.res)?.get('code') ?? ''), WEBVIEW_IP) === null, 'current-build (non-legacy) codes are not exchangeable through the shim')
  // Apple is not configured in this harness: check the steer only.
  const appleStart = await legacyNativeAuth(legacySocial({ provider: 'apple', callbackURL: LEGACY_NATIVE_CALLBACK_URL, disableRedirect: true }), BASE, store, WEBVIEW_IP)
  const appleUrl = new URL(appleStart?.kind === 'respond' ? ((await appleStart.response.json()) as { url: string }).url : 'about:blank')
  ok(appleUrl.searchParams.get('provider') === 'apple' && Boolean(appleUrl.searchParams.get('legacy')), 'legacy Apple start keeps the provider')

  // Untouched paths.
  ok(await legacyNativeAuth(new Request(`${BASE}/api/auth/callback/google?code=c&state=s`, { headers: TAURI }), BASE, store, WEBVIEW_IP) === null, 'real provider callbacks (with state) go to Better Auth')
  ok(await legacyNativeAuth(new Request(`${BASE}/api/auth/callback/google?error=access_denied&code=c`, { headers: TAURI }), BASE, store, WEBVIEW_IP) === null, 'provider error callbacks go to Better Auth')
  ok(await legacyNativeAuth(new Request(`${BASE}/api/auth/callback/google?code=c`, { method: 'POST', headers: TAURI }), BASE, store, WEBVIEW_IP) === null, 'Apple form_post callbacks go to Better Auth')
  ok(await legacyNativeAuth(legacySocial({ provider: 'google', callbackURL: 'https://usedayspring.app' }), BASE, store, WEBVIEW_IP) === null, 'web social sign-in is not rewritten')
  ok(await legacyNativeAuth(legacySocial({ provider: 'apple', callbackURL: LEGACY_NATIVE_CALLBACK_URL, idToken: { token: 't' } }), BASE, store, WEBVIEW_IP) === null, 'native id-token sign-in is not rewritten')
  ok(await legacyNativeAuth(legacySocial({ provider: 'github', callbackURL: LEGACY_NATIVE_CALLBACK_URL }), BASE, store, WEBVIEW_IP) === null, 'unknown providers are not rewritten')
  ok(await legacyNativeAuth(new Request(`${BASE}/api/auth/sign-in/social`, { method: 'POST', headers: TAURI, body: 'not json' }), BASE, store, WEBVIEW_IP) === null, 'non-JSON social sign-in falls through')
  ok(!isLegacyNativeCandidate(new Request(`${BASE}/api/auth/get-session`, { headers: TAURI })), 'ordinary auth requests skip the shim')
}

globalThis.fetch = realFetch
console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('native auth: ok')
