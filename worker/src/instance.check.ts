// Run: node --experimental-strip-types worker/src/instance.check.ts
// Sequential fetches on one Worker isolate: OTP send, authed write, forged 401.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { unstable_dev } from 'wrangler'
import { createAuth } from './auth.ts'
import { openWireSql } from './testPg.ts'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(join(root, 'dist/index.html'), '<!doctype html><title>dayspring</title>\n')

const secret = 'x'.repeat(32)
const authUrl = 'http://127.0.0.1:8787'
const wire = await openWireSql()

const otps: Array<{ email: string; otp: string }> = []
const pool = new Pool({ connectionString: wire.url, max: 1 })
const mint = createAuth(
  {
    ENVIRONMENT: 'local',
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: authUrl,
    DATABASE_URL: wire.url,
  },
  pool,
  { onOtp: (payload) => otps.push(payload) },
)
const email = `ivy-${crypto.randomUUID()}@example.test`
await mint.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
const code = otps.filter((row) => row.email === email).at(-1)?.otp
if (!code) throw new Error('failed to mint OTP for instance fixture')
const signed = await mint.api.signInEmailOTP({ body: { email, otp: code } })
const token = signed.token
if (!token) throw new Error('failed to mint session token')
await pool.end()

const worker = await unstable_dev(join(root, 'worker/src/index.ts'), {
  config: join(root, 'worker/wrangler.instance-test.jsonc'),
  ip: '127.0.0.1',
  localProtocol: 'http',
  persist: false,
  logLevel: 'error',
  vars: {
    ENVIRONMENT: 'local',
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: authUrl,
    DATABASE_URL: wire.url,
  },
  experimental: { disableExperimentalWarning: true },
})

async function timedFetch(path: string, init: RequestInit, ms = 20_000): Promise<Response> {
  return await Promise.race([
    worker.fetch(`http://127.0.0.1${path}`, init),
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error(`hung: ${init.method ?? 'GET'} ${path}`)), ms)
    }),
  ])
}

try {
  const otp = await timedFetch('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `otp-${crypto.randomUUID()}@example.test`, type: 'sign-in' }),
  })
  ok(otp.status < 500, `OTP send is not 5xx (got ${otp.status})`)
  await otp.text()

  const write = await timedFetch('/api/data/entries/upsert-checked', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      created_at: '2026-03-01T12:00:00.000Z',
      body_markdown: 'from the isolate',
      title: 'Isolate',
      mood: null,
      tags: ['mercy'],
      word_count: 3,
      source: 'native',
      external_id: null,
      base_updated_at: null,
      circumstances: {},
    }),
  })
  ok(write.status === 200, `authed write is 200 (got ${write.status})`)
  const written = await write.json() as { conflicted?: boolean }
  ok(written.conflicted === false, 'authed write is not conflicted')

  const denied = await timedFetch('/api/data/entries', {
    headers: { authorization: 'Bearer forged-token-should-401' },
  })
  ok(denied.status === 401, `invalid bearer is 401 (got ${denied.status})`)
} catch (err) {
  ok(false, err instanceof Error ? err.message : String(err))
} finally {
  await worker.stop()
  await wire.close()
}

console.log(`${checks} checks, ${fails.length} failed (${wire.kind})`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('same-instance worker: ok')
