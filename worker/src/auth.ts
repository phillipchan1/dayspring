import { betterAuth } from 'better-auth'
import { bearer, emailOTP } from 'better-auth/plugins'
import { Pool } from 'pg'
import { authCookieSecure, isLocalAuthHost, isLocalAuthRuntime, resolveAuthBaseURL } from './authUrl.ts'
import { withPgSslMode } from './db.ts'
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
  if (!env.RESEND_API_KEY) {
    if (shouldLogOtp(env)) {
      console.log(`[auth] OTP for ${email} (${type}): ${otp}`)
    }
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Dayspring <hello@usedayspring.app>',
      to: email,
      subject,
      text,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`resend ${res.status}: ${body.slice(0, 200)}`)
  }
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
  const db = database ?? (owned = new Pool({
    connectionString: withPgSslMode(url!),
    max: 1,
  }))
  const auth = betterAuth({
    secret,
    baseURL,
    basePath: '/api/auth',
    database: db as Pool,
    emailAndPassword: { enabled: false },
    user: authModels.user,
    session: authModels.session,
    account: authModels.account,
    verification: authModels.verification,
    trustedOrigins: isLocalAuthHost(baseURL)
      ? [baseURL, 'http://localhost:5173', 'http://localhost:5180', 'http://localhost:8787', 'http://[::1]:5173', 'http://[::1]:5180', 'http://[::1]:8787']
      : [baseURL],
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: authCookieSecure(baseURL),
        httpOnly: true,
        path: '/',
      },
    },
    plugins: [
      bearer(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
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
