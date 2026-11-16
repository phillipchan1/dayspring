/**
 * Signed Better Auth bearer for the Workers backend (web + iOS Tauri).
 * The session table stores the raw token; only `set-auth-token` (HMAC over
 * that value) is a valid Authorization header once requireSignature is on.
 */
export const WORKERS_BEARER_KEY = 'dayspring.workers.bearer'

let memory: string | null = null

export function isSignedWorkersBearer(token: string | null | undefined): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  return dot > 0 && dot < token.length - 1
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readWorkersBearer(): string | null {
  const stored = storage()?.getItem(WORKERS_BEARER_KEY) ?? memory
  return isSignedWorkersBearer(stored) ? stored : null
}

export function rememberWorkersBearer(token: string | null | undefined): void {
  if (!isSignedWorkersBearer(token) || !token) {
    memory = null
    storage()?.removeItem(WORKERS_BEARER_KEY)
    return
  }
  memory = token
  storage()?.setItem(WORKERS_BEARER_KEY, token)
}

export function clearWorkersBearer(): void {
  memory = null
  storage()?.removeItem(WORKERS_BEARER_KEY)
}

/**
 * Persist `set-auth-token` from a Better Auth response (the signed form).
 *
 * Better Auth only sends the header when the response creates or refreshes a
 * session, so most responses (get-session, list-accounts, …) have none. A
 * missing header must leave the stored bearer alone: clearing it here signed
 * the native apps out right after a successful sign-in ("We couldn't reach
 * your account"). Signing out clears it explicitly (clearWorkersBearer).
 */
export function captureSignedBearer(
  headers: Headers | { get(name: string): string | null },
): string | null {
  const token = headers.get('set-auth-token')
  if (token === null) return null
  rememberWorkersBearer(token)
  return isSignedWorkersBearer(token) ? token : null
}
