/**
 * Better Auth client. Imported only when `isWorkersBackend` is true so the
 * shipped Supabase build never loads it.
 *
 * iOS (Tauri) and web both send `Authorization: Bearer`. After
 * `bearer({ requireSignature: true })` that value must be the signed
 * `set-auth-token` header, never `session.token` from the database.
 */
import { env } from './env'
import {
  captureSignedBearer,
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

export async function signInWorkersEmailOtp(email: string, otp: string): Promise<void> {
  const auth = await workersAuthClient()
  const result = await auth.signIn.emailOtp({ email, otp })
  if (result.error) throw new Error(result.error.message || 'Sign-in failed')
  if (!readWorkersBearer()) throw new Error('signed bearer missing from sign-in')
}

export async function sendWorkersEmailOtp(email: string): Promise<void> {
  const auth = await workersAuthClient()
  const result = await auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
  if (result.error) throw new Error(result.error.message || 'Could not send code')
}
