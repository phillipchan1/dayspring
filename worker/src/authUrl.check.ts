// Run: node --experimental-strip-types worker/src/authUrl.check.ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldLogOtp } from './auth.ts'
import { postgresSslOption, withPgSslMode } from './db.ts'
import { app } from './index.ts'
import { authConfigErrorResponse, beginAuthCors } from './cors.ts'
import { timingSafeEqualString } from './safeEqual.ts'
import {
  authCookieSecure,
  canonicalizeHostname,
  connectionHostname,
  isLocalAuthHost,
  isLocalAuthRuntime,
  isLoopbackHostname,
  resolveAuthBaseURL,
} from './authUrl.ts'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const neon = 'postgresql://neondb@ep-prod.us-east-1.aws.neon.tech/dayspring'
const prodWithLocalUser = 'postgresql://localhost_admin@ep-prod.neon.tech/dayspring'
const prodWithLocalDb = 'postgresql://app@ep-prod.neon.tech/localhost'
const prodWithLocalQuery = 'postgresql://app@ep-prod.neon.tech/dayspring?application_name=localhost&sslmode=require'
const prodWithLocalPass = 'postgresql://app:localhost@ep-prod.neon.tech/dayspring'
const loopbackPg = 'postgresql://postgres@localhost:5432/dayspring'
const loopbackV4 = 'postgresql://postgres@127.0.0.1:5432/dayspring'
const loopbackV6 = 'postgresql://postgres:postgres@[::1]:5432/dayspring'
const leadingZeroHost = 'postgresql://u@0127.0.0.1:5432/dayspring'
const bare127 = 'postgresql://u@127:5432/dayspring'

ok(isLoopbackHostname('::1'), '::1 hostname is loopback')
ok(isLoopbackHostname('[::1]'), '[::1] hostname is loopback')
ok(isLocalAuthHost('http://[::1]:8787'), '[::1] auth origin is local')
ok(isLocalAuthHost('http://[::1]'), '[::1] without port is local')
ok(!authCookieSecure('http://[::1]:8787'), '[::1] cookies are not Secure')
ok(!isLocalAuthRuntime({}), '[::1] DB hostname is not a local runtime without ENVIRONMENT')
ok(connectionHostname(loopbackV6) === '[::1]' || connectionHostname(loopbackV6) === '::1', '[::1] postgres hostname parses')

ok(isLocalAuthHost('http://localhost:8787'), 'localhost is local')
ok(isLocalAuthHost('http://127.0.0.1:5173'), '127.0.0.1 is local')
ok(isLoopbackHostname('127.1'), '127.1 hostname is loopback')
ok(isLocalAuthHost('http://127.1:8787'), '127.1 auth origin is local')
ok(canonicalizeHostname('127.1') === '127.0.0.1', '127.1 canonicalizes to 127.0.0.1')
ok(canonicalizeHostname('0127.0.0.1') === '87.0.0.1', '0127.0.0.1 canonicalizes off loopback')
ok(canonicalizeHostname('127') === '0.0.0.127', 'bare 127 canonicalizes to 0.0.0.127')
ok(!isLoopbackHostname('0127.0.0.1'), 'leading-zero IPv4 is not loopback')
ok(!isLoopbackHostname('127'), 'bare 127 is not loopback')
ok(connectionHostname(leadingZeroHost) === '0127.0.0.1', 'postgres:// keeps unnormalized 0127 host')
ok(
  !isLoopbackHostname(connectionHostname(leadingZeroHost) ?? ''),
  'unnormalized 0127 postgres host is not loopback',
)
ok(!isLocalAuthHost('https://dayspring.example.workers.dev'), 'workers.dev is not local')
ok(!authCookieSecure('http://localhost:8787'), 'localhost cookies are not Secure')
ok(authCookieSecure('https://dayspring.example.workers.dev'), 'prod cookies are Secure')

ok(!isLocalAuthRuntime({}), 'empty env is not local')
ok(!isLocalAuthRuntime({ ENVIRONMENT: 'dev' }), 'ENVIRONMENT=dev is not local')
ok(!isLocalAuthRuntime({ ENVIRONMENT: 'development' }), 'ENVIRONMENT=development is not local')
ok(isLocalAuthRuntime({ ENVIRONMENT: 'local' }), 'ENVIRONMENT=local is local')
ok(isLocalAuthRuntime({ ENVIRONMENT: 'LOCAL' }), 'ENVIRONMENT=LOCAL is local')
ok(isLocalAuthRuntime({ ENVIRONMENT: 'local' }), 'ENVIRONMENT=local is the only local runtime')
ok(connectionHostname(prodWithLocalUser) === 'ep-prod.neon.tech', 'parses host not user')
ok(connectionHostname(prodWithLocalDb) === 'ep-prod.neon.tech', 'parses host not db name')
ok(connectionHostname(prodWithLocalQuery) === 'ep-prod.neon.tech', 'parses host not query')

ok(
  resolveAuthBaseURL({ BETTER_AUTH_URL: 'https://dayspring.example.workers.dev/' }) === 'https://dayspring.example.workers.dev',
  'configured URL wins and strips trailing slash',
)
ok(
  resolveAuthBaseURL({ ENVIRONMENT: 'local' }) === 'http://localhost:8787',
  'unset URL falls back when ENVIRONMENT=local',
)

function throwsUnset(env: Parameters<typeof resolveAuthBaseURL>[0]): boolean {
  try {
    resolveAuthBaseURL(env)
    return false
  } catch (err) {
    return err instanceof Error && err.message.includes('BETTER_AUTH_URL must be set')
  }
}

ok(throwsUnset({ DATABASE_URL: neon }), 'unset URL + Neon throws')
ok(throwsUnset({}), 'unset URL with no local signal throws')
ok(throwsUnset({ BETTER_AUTH_URL: '   ', DATABASE_URL: neon }), 'whitespace URL throws outside local')
ok(throwsUnset({ DATABASE_URL: prodWithLocalUser }), 'unset URL + localhost in user throws')
ok(throwsUnset({ DATABASE_URL: prodWithLocalDb }), 'unset URL + localhost in db name throws')
ok(throwsUnset({ DATABASE_URL: prodWithLocalQuery }), 'unset URL + localhost in query throws')
ok(throwsUnset({ ENVIRONMENT: 'dev', DATABASE_URL: neon }), 'ENVIRONMENT=dev + Neon throws')
ok(throwsUnset({ DATABASE_URL: loopbackPg }), 'unset URL + real loopback DB still throws')
ok(throwsUnset({ DATABASE_URL: loopbackV4 }), 'unset URL + 127.0.0.1 DB still throws')
ok(throwsUnset({ DATABASE_URL: leadingZeroHost }), 'unset URL + 0127.0.0.1 throws')
ok(throwsUnset({ DATABASE_URL: bare127 }), 'unset URL + bare 127 throws')
ok(throwsUnset({ HYPERDRIVE: { connectionString: leadingZeroHost } }), 'unset URL + Hyperdrive 0127 throws')

ok(withPgSslMode(neon).includes('sslmode=verify-full'), 'Neon URL gets sslmode=verify-full')
ok(postgresSslOption(neon) === 'require', 'Neon uses TLS')
ok(postgresSslOption(loopbackV4) === false, '127.0.0.1 disables TLS')
ok(postgresSslOption(loopbackPg) === false, 'localhost disables TLS')
ok(postgresSslOption(prodWithLocalPass) === 'require', 'localhost in password still uses TLS')
ok(postgresSslOption(prodWithLocalDb) === 'require', 'localhost db name still uses TLS')
ok(postgresSslOption(prodWithLocalQuery) === 'require', 'explicit sslmode=require is TLS')
ok(postgresSslOption(`${neon}?sslmode=disable`) === false, 'explicit sslmode=disable is honored')
ok(
  !readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../scripts/seed-synthetic.mjs'), 'utf8')
    .includes('/localhost|127'),
  'seed-synthetic does not substring-match TLS',
)

ok(shouldLogOtp({ ENVIRONMENT: 'local' }), 'OTP may log when ENVIRONMENT=local')
ok(!shouldLogOtp({}), 'OTP must not log when ENVIRONMENT is unset')
ok(!shouldLogOtp({ ENVIRONMENT: 'preview' }), 'OTP must not log on preview')

ok(timingSafeEqualString('Bearer secret', 'Bearer secret'), 'cron compare equal')
ok(!timingSafeEqualString('Bearer secret', 'Bearer secreT'), 'cron compare rejects mismatch')
ok(!timingSafeEqualString('Bearer secret', 'Bearer secrets'), 'cron compare rejects length mismatch')
ok(!timingSafeEqualString('', 'Bearer secret'), 'cron compare rejects empty header')

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const wrangler = readFileSync(join(root, 'wrangler.jsonc'), 'utf8')
ok(
  wrangler.includes('ENVIRONMENT=local'),
  'wrangler.jsonc documents ENVIRONMENT=local',
)
ok(
  wrangler.includes('https://dayspring-preview.nq-morning-briefing.workers.dev'),
  'preview BETTER_AUTH_URL is the workers.dev origin',
)
const previewBlock = wrangler.slice(wrangler.indexOf('"preview"'))
ok(
  !previewBlock.includes('00000000000000000000000000000000'),
  'preview env does not bind a placeholder Hyperdrive id',
)
ok(
  wrangler.includes('"id": "00000000000000000000000000000000"'),
  'top-level production still has a Hyperdrive placeholder',
)
ok(
  !readFileSync(join(root, 'worker/src/db.ts'), 'utf8').includes('fetch_types: false'),
  'postgres.js fetch_types stays on so array inserts bind',
)
ok(
  !readFileSync(join(root, 'worker/src/db.ts'), 'utf8').includes('WeakMap'),
  'db.ts does not cache clients in a WeakMap',
)
ok(
  !readFileSync(join(root, 'worker/src/auth.ts'), 'utf8').includes('const cache = new WeakMap'),
  'auth.ts does not cache Better Auth in a WeakMap',
)
ok(
  readFileSync(join(root, 'worker/src/auth.ts'), 'utf8').includes('requireSignature: true'),
  'bearer plugin requires a signed token',
)
ok(
  !readFileSync(join(root, 'src/lib/authClient.ts'), 'utf8').includes('session?.token'),
  'iOS/web client does not send the raw session.token as a bearer',
)
ok(
  !readFileSync(join(root, 'worker/src/db.ts'), 'utf8').includes("url.includes('localhost')"),
  'db.ts does not substring-match localhost for TLS',
)
ok(
  readFileSync(join(root, 'worker/src/index.ts'), 'utf8').includes("'authentication failed'"),
  'auth 500 returns a generic error',
)
ok(
  !/error: message/.test(readFileSync(join(root, 'worker/src/index.ts'), 'utf8'))
    && !readFileSync(join(root, 'worker/src/index.ts'), 'utf8').includes('err.message'),
  'auth handler does not echo err.message',
)
ok(
  readFileSync(join(root, 'worker/src/index.ts'), 'utf8').includes('timingSafeEqualString'),
  'cron secret is compared in constant time',
)
ok(
  /ENVIRONMENT=local/.test(readFileSync(join(root, '.dev.vars.example'), 'utf8')),
  '.dev.vars.example sets ENVIRONMENT=local',
)
ok(
  readFileSync(join(root, 'docs/cloudflare-migration/cutover.md'), 'utf8').includes('ENVIRONMENT'),
  'cutover docs mention ENVIRONMENT',
)

const prodEnv = {
  DATABASE_URL: prodWithLocalUser,
  BETTER_AUTH_SECRET: 'x'.repeat(32),
}
const started = beginAuthCors('https://dayspring.example', prodEnv)
ok(!started.ok, 'beginAuthCors fails closed when URL unset outside local')
if (!started.ok) {
  ok(started.response.status === 500, 'misconfig status is 500')
  ok(
    (started.response.headers.get('content-type') ?? '').includes('application/json'),
    'misconfig is JSON',
  )
  ok(
    started.response.headers.get('access-control-allow-origin') == null,
    'non-loopback misconfig omits ACAO',
  )
  ok(
    started.response.headers.get('access-control-allow-credentials') == null,
    'non-loopback misconfig omits credentials',
  )
  const body = await started.response.json() as { error?: string }
  ok(
    typeof body.error === 'string' && body.error.includes('BETTER_AUTH_URL must be set'),
    'misconfig body names BETTER_AUTH_URL',
  )
}

const loopbackErr = authConfigErrorResponse('http://localhost:5180', new Error('BETTER_AUTH_URL must be set'))
ok(loopbackErr.headers.get('access-control-allow-origin') === 'http://localhost:5180', 'loopback misconfig echoes Origin')
ok(loopbackErr.headers.get('access-control-allow-credentials') === 'true', 'loopback misconfig keeps credentials')

const noOrigin = authConfigErrorResponse(null, new Error('BETTER_AUTH_URL must be set'))
ok(noOrigin.status === 500, 'misconfig without Origin is 500')
ok(noOrigin.headers.get('access-control-allow-origin') == null, 'no-Origin misconfig omits ACAO')
ok(noOrigin.headers.get('access-control-allow-credentials') == null, 'no-Origin misconfig omits credentials')

for (const origin of ['https://evil.test', 'http://0127.0.0.1:5173', 'http://127:5173'] as const) {
  const res = await app.request('http://localhost/api/auth/ok', {
    method: 'POST',
    headers: { Origin: origin },
  }, prodEnv)
  ok(res.status === 500, `${origin}: JSON 500`)
  ok(res.headers.get('access-control-allow-origin') == null, `${origin}: no ACAO`)
}

for (const method of ['OPTIONS', 'GET', 'POST'] as const) {
  const res = await app.request(`http://localhost/api/auth/ok`, {
    method,
    headers: { Origin: 'https://evil.example' },
  }, prodEnv)
  ok(res.status === 500, `${method} evil.example: JSON 500`)
  ok(res.headers.get('access-control-allow-origin') == null, `${method} evil.example: no ACAO`)
  ok(res.headers.get('access-control-allow-credentials') == null, `${method} evil.example: no credentials`)
}

const localOk = beginAuthCors('http://localhost:5180', { ENVIRONMENT: 'local' })
ok(localOk.ok, 'beginAuthCors succeeds when ENVIRONMENT=local')
if (localOk.ok) {
  ok(
    localOk.cors['Access-Control-Allow-Origin'] === 'http://localhost:5180',
    'local CORS echoes vite origin',
  )
}

ok(
  (await app.request('http://localhost/api/health')).status === 200,
  'GET /api/health is 200 without auth',
)

console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('authUrl: ok')
