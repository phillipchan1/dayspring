import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { bearer, emailOTP, oneTimeToken } from 'better-auth/plugins'
import { verifyPassword as verifyBetterAuthPassword } from 'better-auth/crypto'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { NATIVE_APP_ORIGINS } from './cors.ts'
import { authCookieSecure, isLocalAuthHost, isLocalAuthRuntime, resolveAuthBaseURL } from './authUrl.ts'
import { pgClientOptions } from './db.ts'
import { databaseUrl, type Env } from './env.ts'

export type AuthInstance = ReturnType<typeof createAuth>

const ownedPools = new WeakMap<object, Pool>()

export function shouldLogOtp(env: Pick<Env, 'ENVIRONMENT'>): boolean {
  return isLocalAuthRuntime(env)
}

async function sendOtpEmail(env: Env, email: string, otp: string, type: string): Promise<void> {
  const subject = type === 'forget-password'
    ? 'Reset your Dayspring sign-in'
    : 'Your Dayspring sign-in code'
  const text = `Your code is ${otp}. It expires in 5 minutes.\n\nIf you did not request this, ignore the email.`
  if (!env.EMAIL) {
    if (shouldLogOtp(env)) {
      console.log(`[auth] OTP for ${email} (${type}): ${otp}`)
    }
    return
  }
  await env.EMAIL.send({
    from: { name: 'Dayspring', email: 'hello@usedayspring.app' },
    to: email,
    subject,
    text,
  })
}

/**
 * Neon / PGlite columns are snake_case. Better Auth's default identifiers are
 * camelCase (`emailVerified`, `expiresAt`, `userId`, …). Without this map the
 * adapter emits `column "emailVerified" does not exist` and OTP send 500s.
 */
export const authModels = {
  user: {
    modelName: 'user',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'session',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
  },
  account: {
    modelName: 'account',
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verification',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
} as const

/** `pg.Pool` or a PGlite stand-in with the same connect/query/end surface. */
export type AuthDatabase = Pool | {
  connect(): Promise<{
    query(sql: string, parameters: readonly unknown[]): Promise<{ command: string; rowCount: number; rows: unknown[] }>
    release(): void
  }>
  end(): Promise<void>
  options: object
}

/**
 * Supabase stored passwords as bcrypt (`$2a$…`); the Neon copy carries those
 * hashes over as `credential` accounts (scripts/migrate-neon.mjs). Better
 * Auth's own hashes are scrypt (`salt:key`). Accept both so people who
 * signed up before the Cloudflare move keep their password; new and changed
 * passwords are always scrypt.
 */
export async function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  if (/^\$2[aby]\$\d{2}\$/.test(hash)) return bcrypt.compare(password, hash)
  return verifyBetterAuthPassword({ hash, password })
}

export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 365
export const SESSION_UPDATE_AGE = 60 * 60 * 24

/**
 * Persist Better Auth's limiter in Neon so it is shared across Worker isolates.
 * `customStorage` (wired in createAuth) fail-opens if this table is missing.
 * Do not set `storage: 'database'` — that makes Better Auth require `rate_limit`
 * at startup (`Database schema mismatch`) and every `/api/auth/*` route dies.
 */
export const AUTH_RATE_LIMIT = {
  enabled: true,
  modelName: 'rate_limit',
  fields: { lastRequest: 'last_request' as const },
}

export const OTP_EMAIL_WINDOW_MS = 10 * 60 * 1000
export const OTP_EMAIL_MAX = 5
export const OTP_EMAIL_KEY_PREFIX = 'otp-email:'

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function otpEmailLimitKey(email: string): Promise<string> {
  return `${OTP_EMAIL_KEY_PREFIX}${await sha256Hex(email.trim().toLowerCase())}`
}

function warnRateLimitOpen(table: 'rate_limit' | 'otp_send_limit'): void {
  console.warn(`[auth] ${table} unavailable; allowing request`)
}

/** Fail-open Better Auth limiter: missing table or query error never blocks auth. */
export function failOpenRateLimitStorage(db: AuthDatabase) {
  return {
    async consume(key: string, rule: { window: number; max: number }) {
      const client = await db.connect()
      try {
        const now = Date.now()
        const windowMs = rule.window * 1000
        const result = await client.query(
          `INSERT INTO rate_limit (id, key, count, last_request)
           VALUES ($1, $2, 1, $3)
           ON CONFLICT (key) DO UPDATE SET
             count = CASE WHEN $3::bigint - rate_limit.last_request > $4::bigint THEN 1 ELSE rate_limit.count + 1 END,
             last_request = CASE WHEN $3::bigint - rate_limit.last_request > $4::bigint THEN $3::bigint ELSE rate_limit.last_request END
           RETURNING count, last_request`,
          [crypto.randomUUID(), key, String(now), String(windowMs)],
        )
        const row = result.rows[0] as { count?: number; last_request?: number } | undefined
        const count = Number(row?.count ?? 1)
        const last = Number(row?.last_request ?? now)
        if (count <= rule.max) return { allowed: true as const, retryAfter: null }
        const retryAfter = Math.max(1, Math.ceil((last + windowMs - now) / 1000))
        return { allowed: false as const, retryAfter }
      } catch {
        warnRateLimitOpen('rate_limit')
        return { allowed: true as const, retryAfter: null }
      } finally {
        client.release()
      }
    },
  }
}

async function allowEmailOtp(db: AuthDatabase, email: string): Promise<boolean> {
  const key = await otpEmailLimitKey(email)
  const client = await db.connect()
  try {
    const now = String(Date.now())
    const window = String(OTP_EMAIL_WINDOW_MS)
    const result = await client.query(
      `INSERT INTO otp_send_limit (key, count, window_start)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN $2::bigint - otp_send_limit.window_start > $3::bigint THEN 1 ELSE otp_send_limit.count + 1 END,
         window_start = CASE WHEN $2::bigint - otp_send_limit.window_start > $3::bigint THEN $2::bigint ELSE otp_send_limit.window_start END
       RETURNING count`,
      [key, now, window],
    )
    const count = Number((result.rows[0] as { count: number } | undefined)?.count ?? 1)
    return count <= OTP_EMAIL_MAX
  } catch {
    warnRateLimitOpen('otp_send_limit')
    return true
  } finally {
    client.release()
  }
}

const DEEP_LINK_ORIGIN = 'https://dayspring-eosin.vercel.app'

/** Apple + Google only when client id and secret are both set. */
export function socialProvidersFromEnv(env: Env): BetterAuthOptions['socialProviders'] {
  const appleId = env.APPLE_CLIENT_ID?.trim()
  const appleSecret = env.APPLE_CLIENT_SECRET?.trim()
  const googleId = env.GOOGLE_CLIENT_ID?.trim()
  const googleSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  const bundle = env.APPLE_APP_BUNDLE_IDENTIFIER?.trim()
  const apple = appleId && appleSecret
    ? {
        clientId: appleId,
        clientSecret: appleSecret,
        ...(bundle ? { appBundleIdentifier: bundle } : {}),
      }
    : undefined
  const google = googleId && googleSecret
    ? { clientId: googleId, clientSecret: googleSecret }
    : undefined
  if (!apple && !google) return undefined
  return {
    ...(apple ? { apple } : {}),
    ...(google ? { google } : {}),
  }
}

export function createAuth(
  env: Env,
  database?: AuthDatabase,
  hooks?: { onOtp?: (payload: { email: string; otp: string; type: string }) => void },
) {
  const url = databaseUrl(env)
  if (!database && !url) throw new Error('database is not configured (HYPERDRIVE or DATABASE_URL)')
  const secret = env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set')
  const baseURL = resolveAuthBaseURL(env)
  let owned: Pool | undefined
  const opts = pgClientOptions(env, url!)
  const db = database ?? (owned = new Pool({
    connectionString: opts.connectionString,
    max: 1,
    ...(opts.ssl === false ? { ssl: false } : {}),
  }))
  const auth = betterAuth({
    secret,
    baseURL,
    basePath: '/api/auth',
    database: db as Pool,
    emailAndPassword: { enabled: true, password: { verify: verifyPassword } },
    user: authModels.user,
    session: {
      ...authModels.session,
      // Supabase kept people signed in until they signed out. Better Auth's
      // default is 7 days, which signs out anyone who skips a week of
      // journaling. A year, refreshed at most once a day while in use.
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: SESSION_UPDATE_AGE,
    },
    account: authModels.account,
    verification: authModels.verification,
    socialProviders: socialProvidersFromEnv(env),
    trustedOrigins: isLocalAuthHost(baseURL)
      ? [baseURL, DEEP_LINK_ORIGIN, ...NATIVE_APP_ORIGINS, 'http://localhost:5173', 'http://localhost:5180', 'http://localhost:8787', 'http://[::1]:5173', 'http://[::1]:5180', 'http://[::1]:8787']
      : [baseURL, DEEP_LINK_ORIGIN, 'dayspring://', ...NATIVE_APP_ORIGINS],
    rateLimit: {
      ...AUTH_RATE_LIMIT,
      customStorage: failOpenRateLimitStorage(db),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/email-otp/send-verification-otp') return
        const email = (ctx.body as { email?: string } | undefined)?.email
        if (typeof email === 'string' && !(await allowEmailOtp(db, email))) {
          throw new APIError('TOO_MANY_REQUESTS', {
            message: 'Too many sign-in codes. Try again in a few minutes.',
          })
        }
      }),
    },
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-real-ip'],
      },
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: authCookieSecure(baseURL),
        httpOnly: true,
        path: '/',
      },
    },
    plugins: [
      bearer({ requireSignature: true }),
      // Native Google / Apple hand-off (worker/src/nativeAuth.ts): the sign-in
      // sheet's session becomes a 3-minute, single-use, hashed-at-rest token
      // the app exchanges for its own bearer.
      oneTimeToken({ expiresIn: 3, storeToken: 'hashed' }),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        rateLimit: { window: 60, max: 30 },
        sendVerificationOTP: async ({ email, otp, type }) => {
          hooks?.onOtp?.({ email, otp, type })
          await sendOtpEmail(env, email, otp, type)
        },
        disableSignUp: false,
      }),
    ],
  })
  if (owned) ownedPools.set(auth, owned)
  return auth
}

/** Per-request Better Auth. Not cached — Workers cannot reuse the Pool. */
export function getAuth(env: Env): AuthInstance {
  return createAuth(env)
}

export async function closeAuth(auth: AuthInstance): Promise<void> {
  const pool = ownedPools.get(auth)
  if (pool) await pool.end()
}

export async function sessionUser(
  auth: AuthInstance,
  req: Request,
): Promise<{ id: string; email?: string | null } | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user?.id) return null
    return { id: session.user.id, email: session.user.email }
  } catch {
    return null
  }
}
