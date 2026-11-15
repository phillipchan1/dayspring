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
  return client.createAuthClient({
    baseURL: apiOrigin(),
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

function apiOrigin(): string {
  return env.apiBaseUrl.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
}

/**
 * Native apps only. The URL the sign-in sheet (iOS) or system browser (Mac)
 * opens. The Worker runs the whole provider round-trip inside that browser —
 * Better Auth's state and session cookies live there, not in the webview — and
 * ends at `dayspring://auth-callback?code=<one-time token>`.
 * See worker/src/nativeAuth.ts.
 *
 * Linking mints a one-time token with this device's bearer first, so the
 * sheet knows which account the new provider attaches to.
 */
export async function nativeOAuthStartUrl(
  provider: 'google' | 'apple',
  intent: 'sign-in' | 'link',
): Promise<string> {
  const params = new URLSearchParams({ provider })
  if (intent === 'link') {
    const auth = await workersAuthClient()
    const result = await auth.$fetch<{ token?: string }>('/one-time-token/generate', { method: 'GET' })
    const token = result.data?.token
    if (result.error || !token) throw new Error(result.error?.message || 'Could not start linking')
    params.set('link', token)
  }
  return `${apiOrigin()}/api/auth/native/start?${params.toString()}`
}

/**
 * Finish a native sign-in: the `code` on dayspring://auth-callback is a
 * single-use token for the session the sign-in sheet just created. Verifying
 * it returns this device's signed bearer in `set-auth-token`.
 */
export async function completeWorkersOAuthCallback(callbackUrl: string): Promise<void> {
  const parsed = callbackUrl.startsWith('?')
    ? new URL(`http://local.invalid${callbackUrl}`)
    : new URL(callbackUrl)
  const error = parsed.searchParams.get('error')
  if (error) throw new Error(oauthErrorMessage(error))
  const code = parsed.searchParams.get('code')
  if (!code) throw new Error('No authorization code in OAuth callback')
  const auth = await workersAuthClient()
  const result = await auth.$fetch('/one-time-token/verify', { method: 'POST', body: { token: code } })
  if (result.error) throw new Error(result.error.message || 'Sign-in expired. Try again.')
  if (!readWorkersBearer()) throw new Error('signed bearer missing from OAuth callback')
  await hydrateAfterAuth()
}

function oauthErrorMessage(code: string): string {
  switch (code) {
    case 'account_not_linked':
    case 'account_already_linked_to_different_user':
      return 'That account is already used by another Dayspring sign-in.'
    case 'link_expired':
      return 'Linking took too long. Try again.'
    case 'access_denied':
      return 'Sign-in was cancelled.'
    default:
      return 'Sign-in didn’t finish. Try again, or use email.'
  }
}
