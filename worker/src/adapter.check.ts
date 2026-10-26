// Run: node --experimental-strip-types worker/src/adapter.check.ts
// Proves Better Auth insert/select against the snake_case Neon schema.
import { PGlite } from '@electric-sql/pglite'
import { applyNeonSchema } from './isolationDb.ts'
import { authModels, createAuth, type AuthDatabase } from './auth.ts'
import { stripGetSessionToken } from './sessionBody.ts'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

function commandOf(sql: string): 'UPDATE' | 'DELETE' | 'INSERT' | 'SELECT' | 'MERGE' {
  const verb = sql.trim().split(/\s+/)[0]?.toUpperCase()
  if (verb === 'UPDATE' || verb === 'DELETE' || verb === 'INSERT' || verb === 'SELECT' || verb === 'MERGE') {
    return verb
  }
  return 'SELECT'
}

function makePglitePool(db: PGlite): AuthDatabase {
  const query = async (sql: string, parameters: readonly unknown[]) => {
    const result = await db.query(sql, parameters as unknown[])
    return {
      command: commandOf(sql),
      rowCount: result.affectedRows ?? result.rows.length,
      rows: result.rows,
    }
  }
  return {
    options: {},
    async connect() {
      return {
        query,
        release() {},
      }
    },
    async end() {},
  }
}

{
  const stripped = await stripGetSessionToken(
    new Response(JSON.stringify({ session: { id: 'sess', token: 'raw-db-token' }, user: { id: 'user' } }), {
      headers: { 'content-type': 'application/json' },
    }),
    '/api/auth/get-session',
  )
  const body = await stripped.json() as { session?: { id?: string; token?: string }; user?: { id?: string } }
  ok(body.session?.id === 'sess', 'stripGetSessionToken keeps session.id')
  ok(body.session?.token == null, 'stripGetSessionToken removes session.token')
  ok(body.user?.id === 'user', 'stripGetSessionToken keeps user')
}

ok(authModels.user.fields.emailVerified === 'email_verified', 'user.emailVerified maps to email_verified')
ok(authModels.session.fields.userId === 'user_id', 'session.userId maps to user_id')
ok(authModels.account.fields.accountId === 'account_id', 'account.accountId maps to account_id')
ok(authModels.verification.fields.expiresAt === 'expires_at', 'verification.expiresAt maps to expires_at')

try {
  createAuth({
    DATABASE_URL: 'postgresql://neondb@ep-prod.us-east-1.aws.neon.tech/dayspring',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
  })
  ok(false, 'createAuth unset BETTER_AUTH_URL + Neon must throw')
} catch (err) {
  ok(
    err instanceof Error && err.message.includes('BETTER_AUTH_URL must be set'),
    'createAuth fails closed when BETTER_AUTH_URL is unset',
  )
}

const db = new PGlite()
await applyNeonSchema(db)

const otps: Array<{ email: string; otp: string; type: string }> = []
const auth = createAuth(
  {
    ENVIRONMENT: 'local',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/dayspring',
  },
  makePglitePool(db),
  { onOtp: (payload) => otps.push(payload) },
)
const ctx = await auth.$context

const created = await ctx.adapter.create<{
  id: string
  email: string
  emailVerified: boolean
  name: string
}>({
  model: 'user',
  data: {
    name: 'Ada',
    email: 'ada@example.test',
    emailVerified: true,
  },
})
ok(typeof created.id === 'string' && created.id.length > 0, 'adapter create user returns id')
ok(created.email === 'ada@example.test', 'adapter create user returns camelCase email')
ok(created.emailVerified === true, 'adapter create user returns camelCase emailVerified')

const found = await ctx.adapter.findOne<{ email: string; emailVerified: boolean }>({
  model: 'user',
  where: [{ field: 'email', value: 'ada@example.test' }],
})
ok(found?.email === 'ada@example.test', 'adapter findOne user by email')
ok(found?.emailVerified === true, 'adapter findOne user maps emailVerified')

const rawUser = await db.query<{ email_verified: boolean; created_at: Date | string }>(
  'SELECT email_verified, created_at FROM "user" WHERE email = $1',
  ['ada@example.test'],
)
ok(rawUser.rows[0]?.email_verified === true, 'user.email_verified column written')
ok(rawUser.rows[0]?.created_at != null, 'user.created_at column written')

const session = await ctx.adapter.create<{ id: string; token: string; userId: string }>({
  model: 'session',
  data: {
    userId: created.id,
    token: 'session-token-1',
    expiresAt: new Date(Date.now() + 60_000),
  },
})
ok(session.userId === created.id, 'adapter create session returns userId')
const foundSession = await ctx.adapter.findOne<{ token: string; userId: string }>({
  model: 'session',
  where: [{ field: 'token', value: 'session-token-1' }],
})
ok(foundSession?.userId === created.id, 'adapter findOne session by token')
const rawSession = await db.query<{ user_id: string; expires_at: Date | string }>(
  'SELECT user_id, expires_at FROM session WHERE token = $1',
  ['session-token-1'],
)
ok(rawSession.rows[0]?.user_id === created.id, 'session.user_id column written')
ok(rawSession.rows[0]?.expires_at != null, 'session.expires_at column written')

const account = await ctx.adapter.create<{ id: string; accountId: string; providerId: string }>({
  model: 'account',
  data: {
    userId: created.id,
    accountId: 'ada-account',
    providerId: 'credential',
  },
})
ok(account.accountId === 'ada-account', 'adapter create account returns accountId')
const foundAccount = await ctx.adapter.findOne<{ accountId: string; userId: string }>({
  model: 'account',
  where: [{ field: 'accountId', value: 'ada-account' }],
})
ok(foundAccount?.userId === created.id, 'adapter findOne account by accountId')
const rawAccount = await db.query<{ account_id: string; provider_id: string; user_id: string }>(
  'SELECT account_id, provider_id, user_id FROM account WHERE account_id = $1',
  ['ada-account'],
)
ok(rawAccount.rows[0]?.account_id === 'ada-account', 'account.account_id column written')
ok(rawAccount.rows[0]?.provider_id === 'credential', 'account.provider_id column written')
ok(rawAccount.rows[0]?.user_id === created.id, 'account.user_id column written')

const verification = await ctx.adapter.create<{ id: string; identifier: string; value: string }>({
  model: 'verification',
  data: {
    identifier: 'ada@example.test',
    value: '123456',
    expiresAt: new Date(Date.now() + 300_000),
  },
})
ok(verification.identifier === 'ada@example.test', 'adapter create verification')
const foundVerification = await ctx.adapter.findOne<{ identifier: string; value: string }>({
  model: 'verification',
  where: [{ field: 'identifier', value: 'ada@example.test' }],
})
ok(foundVerification?.value === '123456', 'adapter findOne verification')
const rawVerification = await db.query<{ expires_at: Date | string }>(
  'SELECT expires_at FROM verification WHERE identifier = $1',
  ['ada@example.test'],
)
ok(rawVerification.rows[0]?.expires_at != null, 'verification.expires_at column written')

const otp = await auth.api.sendVerificationOTP({
  body: { email: 'ben@example.test', type: 'sign-in' },
})
ok(otp !== false && otp !== null, 'sendVerificationOTP succeeds against snake_case schema')
const otpRows = await db.query<{ identifier: string; expires_at: Date | string }>(
  "SELECT identifier, expires_at FROM verification WHERE identifier LIKE $1",
  ['%ben@example.test%'],
)
ok(otpRows.rows.length >= 1, 'OTP send inserted a verification row')
ok(otpRows.rows[0]?.expires_at != null, 'OTP verification uses expires_at')

const signUpEmail = 'cara@example.test'
const sentSignUp = await auth.api.sendVerificationOTP({
  body: { email: signUpEmail, type: 'sign-in' },
})
ok(sentSignUp.success === true, 'OTP send for sign-up')
const signUpCode = otps.filter((row) => row.email === signUpEmail).at(-1)?.otp
ok(Boolean(signUpCode), 'OTP send delivered a code')

type OtpSession = { user: { id: string; email: string }; token: string }

async function signInOtp(email: string, otp: string): Promise<{ session: OtpSession; signed: string | null }> {
  const result = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  })
  const wrapped = result as { headers?: Headers; response?: OtpSession }
  const session = wrapped.response ?? (result as OtpSession)
  const signed = wrapped.headers?.get('set-auth-token') ?? null
  return { session, signed }
}

async function sessionForBearer(token: string): Promise<{ user?: { id: string }; session?: { token?: string } } | null> {
  const raw = await auth.handler(new Request('http://127.0.0.1/api/auth/get-session', {
    headers: { authorization: `Bearer ${token}` },
  }))
  const res = await stripGetSessionToken(raw, '/api/auth/get-session')
  if (!res.ok) return null
  const body = await res.json() as { user?: { id: string }; session?: { token?: string } } | null
  return body?.user?.id ? body : null
}

const signedUp = await signInOtp(signUpEmail, signUpCode ?? '')
ok(signedUp.session.user.email === signUpEmail, 'OTP sign-up creates the user')
ok(Boolean(signedUp.session.token), 'OTP sign-up returns a session token')
ok(!signedUp.session.token.includes('.'), 'API body token is the unsigned DB value')
ok(Boolean(signedUp.signed && signedUp.signed.includes('.')), 'sign-in sets a signed set-auth-token')
ok(await sessionForBearer(signedUp.session.token) == null, 'raw DB token is not accepted as a bearer')
const afterSignUp = await sessionForBearer(signedUp.signed ?? '')
ok(afterSignUp?.user?.id === signedUp.session.user.id, 'getSession after sign-up with signed bearer')
ok(Boolean(afterSignUp?.user?.id), 'getSession has a session')
ok(afterSignUp?.session?.token == null, 'get-session body does not include session.token')

const sentSignIn = await auth.api.sendVerificationOTP({
  body: { email: signUpEmail, type: 'sign-in' },
})
ok(sentSignIn.success === true, 'OTP send for returning sign-in')
const signInCode = otps.filter((row) => row.email === signUpEmail).at(-1)?.otp
ok(Boolean(signInCode) && signInCode !== signUpCode, 'returning sign-in gets a new OTP')
const signedIn = await signInOtp(signUpEmail, signInCode ?? '')
ok(signedIn.session.user.id === signedUp.session.user.id, 'OTP sign-in is the same user')
const afterSignIn = await sessionForBearer(signedIn.signed ?? '')
ok(afterSignIn?.user?.id === signedUp.session.user.id, 'getSession after sign-in')

console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('auth adapter: ok')
