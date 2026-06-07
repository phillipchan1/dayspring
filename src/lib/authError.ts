import { signOut } from './auth'

/**
 * True when an error means the SESSION / USER is no longer valid — a deleted or
 * disabled account, a revoked/expired/malformed JWT, or a 401/403. This is the
 * signal to drop to the login screen. Crucially it must NOT match a plain
 * network failure (offline), so we never sign a user out for a connectivity
 * blip — only for a definitive auth rejection from the server.
 */
export function isAuthInvalidation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: number; code?: string; message?: string }

  if (e.status === 401 || e.status === 403) return true

  // PostgREST surfaces JWT problems as PGRST301 (expired) / PGRST302 (invalid).
  const code = String(e.code ?? '')
  if (code === 'PGRST301' || code === 'PGRST302') return true

  // GoTrue / PostgREST messages for a deleted or invalid user.
  const msg = String(e.message ?? '').toLowerCase()
  return (
    msg.includes('user from sub claim') || // "User from sub claim in JWT does not exist"
    msg.includes('user_not_found') ||
    msg.includes('invalid jwt') ||
    msg.includes('jwt expired') ||
    msg.includes('invalid claim') ||
    msg.includes('session_not_found') ||
    msg.includes('session from session_id claim')
  )
}

let recovering = false

/**
 * Clean recovery from an invalid session: sign out (which scrubs cached content
 * via the privacy fence) so the auth listener settles the app to the login
 * screen. Guarded so concurrent detectors (boot check + a failing query) only
 * trigger one sign-out.
 */
export async function forceReauth(): Promise<void> {
  if (recovering) return
  recovering = true
  try {
    await signOut()
  } catch {
    /* the auth state listener will still settle the session to null */
  }
}
