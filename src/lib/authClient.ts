/**
 * Better Auth client. Imported only when `isWorkersBackend` is true so the
 * shipped Supabase build never loads it.
 */
import { env } from './env'

export async function getWorkersToken(): Promise<string | null> {
  const mod = await import('better-auth/client')
  const baseURL = env.apiBaseUrl.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
  const auth = mod.createAuthClient({
    baseURL,
    basePath: '/api/auth',
  })
  const session = await auth.getSession()
  const data = session.data as { session?: { token?: string } } | null
  return data?.session?.token ?? null
}
