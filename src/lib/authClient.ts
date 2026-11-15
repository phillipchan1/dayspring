/**
 * Better Auth client for the Cloudflare Worker.
 *
 * iOS (Tauri) and web both send `Authorization: Bearer`. After
 * `bearer({ requireSignature: true })` that value must be the signed
 * `set-auth-token` header, never `session.token` from the database.
 */
import { env } from './env'
import {
  captureSignedBearer,
  clearWorkersBearer,
  readWorkersBearer,
} from './workersBearer'

export {
  captureSignedBearer,
  clearWorkersBearer,
  isSignedWorkersBearer,
  readWorkersBearer,
  rememberWorkersBearer,
} from './workersBearer'

async function workersAuthClient() {
  const [client, emailOtp] = await Promise.all([
    import('better-auth/client'),
    import('better-auth/client/plugins'),
  ])
  const baseURL = env.apiBaseUrl.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
  return client.createAuthClient({
    baseURL,
    basePath: '/api/auth',
    plugins: [emailOtp.emailOTPClient()],
    fetchOptions: {
      auth: {
        type: 'Bearer',
        token: () => readWorkersBearer() ?? '',
      },
      onSuccess(ctx) {
        captureSignedBearer(ctx.response.headers)
      },
    },
  })
}

export async function getWorkersToken(): Promise<string | null> {
  return readWorkersBearer()
}

export async function getWorkersUserId(): Promise<string | null> {
  const session = await getWorkersSession()
  return session?.id ?? null
}

export async function getWorkersSession(): Promise<{
  id: string
  email?: string | null
  provider?: string
} | null> {
  if (!readWorkersBearer()) return null
  const auth = await workersAuthClient()
  const { data, error } = await auth.getSession()
  if (error) {
    const status = (error as { status?: number }).status
    if (status === 401 || status === 403) throw Object.assign(new Error(error.message || 'unauthorized'), { status })
  }
  const row = data as {
    user?: { id?: string; email?: string | null }
    session?: { user?: { id?: string; email?: string | null } }
  } | null
  const user = row?.user ?? row?.session?.user
  if (!user?.id) return null
  return { id: user.id, email: user.email ?? null }
}

export async function signInWorkersEmailOtp(email: string, otp: string): Promise<void> {
  const auth = await workersAuthClient()
  const result = await auth.signIn.emailOtp({ email, otp })
  if (result.error) throw new Error(result.error.message || 'Sign-in failed')
  if (!readWorkersBearer()) throw new Error('signed bearer missing from sign-in')
  await hydrateAfterAuth()
}

export async function sendWorkersEmailOtp(email: string): Promise<void> {
  const auth = await workersAuthClient()
  const result = await auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
  if (result.error) throw new Error(result.error.message || 'Could not send code')
}

export async function signInWorkersSocial(opts: {
  provider: 'google' | 'apple'
  callbackURL: string
  disableRedirect?: boolean
}): Promise<{ data: { url?: string | null } | null; error: Error | null }> {
  const auth = await workersAuthClient()
  const result = await auth.signIn.social({
    provider: opts.provider,
    callbackURL: opts.callbackURL,
    disableRedirect: opts.disableRedirect,
  })
  if (result.error) return { data: null, error: new Error(result.error.message || 'Sign-in failed') }
  const url = (result.data as { url?: string } | null)?.url ?? null
  return { data: { url }, error: null }
}

export async function signInWorkersSocialIdToken(
  provider: 'google' | 'apple',
  token: string,
  nonce?: string,
): Promise<void> {
  const auth = await workersAuthClient()
  const result = await auth.signIn.social({
    provider,
    idToken: { token, nonce },
  })
  if (result.error) throw new Error(result.error.message || 'Sign-in failed')
  if (!readWorkersBearer()) throw new Error('signed bearer missing from social sign-in')
  await hydrateAfterAuth(provider)
}

export async function signOutWorkers(): Promise<void> {
  try {
    const auth = await workersAuthClient()
    await auth.signOut()
  } catch {
    /* token may already be dead */
  }
  clearWorkersBearer()
}

export async function signInWorkersEmail(email: string, password: string): Promise<void> {
  const auth = await workersAuthClient()
  const result = await auth.signIn.email({ email, password })
  if (result.error) throw new Error(result.error.message || 'Sign-in failed')
  if (!readWorkersBearer()) throw new Error('signed bearer missing from sign-in')
  await hydrateAfterAuth()
}

export async function signUpWorkersEmail(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const auth = await workersAuthClient()
  const name = email.split('@')[0] || 'Dayspring'
  const result = await auth.signUp.email({ email, password, name })
  if (result.error) throw new Error(result.error.message || 'Could not create account')
  await hydrateAfterAuth()
  return { needsConfirmation: !readWorkersBearer() }
}

export async function linkWorkersSocial(opts: {
  provider: 'google' | 'apple'
  callbackURL: string
  disableRedirect?: boolean
}): Promise<{ data: { url?: string | null } | null; error: Error | null }> {
  const auth = await workersAuthClient()
  const result = await auth.linkSocial({
    provider: opts.provider,
    callbackURL: opts.callbackURL,
    disableRedirect: opts.disableRedirect,
  })
  if (result.error) return { data: null, error: new Error(result.error.message || 'Link failed') }
  const url = (result.data as { url?: string } | null)?.url ?? null
  return { data: { url }, error: null }
}

export async function listWorkersSignInMethods(): Promise<Array<'google' | 'apple'>> {
  const auth = await workersAuthClient()
  const result = await auth.listAccounts()
  if (result.error) throw new Error(result.error.message || 'Could not list sign-in methods')
  const rows = (result.data ?? []) as Array<{ provider?: string; providerId?: string }>
  const linked = rows.map((r) => r.provider ?? r.providerId)
  return (['google', 'apple'] as const).filter((p) => linked.includes(p))
}

async function hydrateAfterAuth(provider?: string): Promise<void> {
  const token = readWorkersBearer()
  if (!token) return
  const session = await getWorkersSession()
  if (!session) return
  const { applyWorkersSession } = await import('./sessionStore')
  applyWorkersSession({
    token,
    userId: session.id,
    email: session.email ?? null,
    ...(provider ? { provider } : {}),
    event: 'SIGNED_IN',
  })
}

/** Finish a Better Auth OAuth redirect (code/state on the callback URL). */
export async function completeWorkersOAuthCallback(callbackUrl: string): Promise<void> {
  const parsed = callbackUrl.startsWith('?')
    ? new URL(`http://local.invalid${callbackUrl}`)
    : new URL(callbackUrl)
  const code = parsed.searchParams.get('code')
  const state = parsed.searchParams.get('state')
  if (!code) throw new Error('No authorization code in OAuth callback')
  const auth = await workersAuthClient()
  const path = parsed.pathname.includes('/api/auth/callback/')
    ? `${parsed.pathname}${parsed.search}`
    : `/api/auth/callback/apple?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`
  const result = await auth.$fetch(path)
  if (result.error) throw new Error(result.error.message || 'OAuth callback failed')
  if (!readWorkersBearer()) throw new Error('signed bearer missing from OAuth callback')
  await hydrateAfterAuth()
}
