import { isGuestOwnerId } from './guestOwner'
import { isAuthInvalidation, forceReauth } from './authError'
import { rememberAuthProvider } from './lastAuthProvider'
import { applyAuthAnalytics, track } from './analytics'
import { readCacheOwner } from './localData'
import {
  clearWorkersBearer,
  readWorkersBearer,
} from './workersBearer'

/**
 * The signed-in person on this device. Better Auth is the only path.
 * `access_token` is the signed Workers bearer (`dayspring.workers.bearer`).
 */
export interface Session {
  access_token: string
  user: {
    id: string
    email?: string | null
    app_metadata?: { provider?: string }
  }
}

export interface SessionState {
  session: Session | null
  /** True only until the stored session has been read — a few milliseconds. */
  loading: boolean
}

const WORKERS_USER_KEY = 'dayspring.workers.user'

let state: SessionState = { session: null, loading: true }
const listeners = new Set<() => void>()

function set(next: Partial<SessionState>): void {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

export function getSessionState(): SessionState {
  return state
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

interface CachedUser {
  id: string
  email?: string | null
  provider?: string
}

function readCachedUser(): CachedUser | null {
  try {
    const raw = localStorage.getItem(WORKERS_USER_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<CachedUser>
    if (typeof value.id !== 'string' || !value.id) return null
    const user: CachedUser = {
      id: value.id,
      email: typeof value.email === 'string' ? value.email : null,
    }
    if (typeof value.provider === 'string') user.provider = value.provider
    return user
  } catch {
    return null
  }
}

function writeCachedUser(user: CachedUser | null): void {
  try {
    if (!user) localStorage.removeItem(WORKERS_USER_KEY)
    else localStorage.setItem(WORKERS_USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

function sessionFrom(token: string, user: CachedUser): Session {
  return {
    access_token: token,
    user: {
      id: user.id,
      email: user.email ?? null,
      ...(user.provider ? { app_metadata: { provider: user.provider } } : {}),
    },
  }
}

function cachedUserId(): string | null {
  const cached = readCachedUser()
  if (cached?.id) return cached.id
  const owner = readCacheOwner()
  if (owner && !isGuestOwnerId(owner)) return owner
  return null
}

function authMethodFor(provider: unknown): 'apple' | 'google' | 'email' | null {
  return provider === 'apple' || provider === 'google' || provider === 'email' ? provider : null
}

/** Apply a live Better Auth session (after sign-in, OAuth, or getSession). */
export function applyWorkersSession(input: {
  token: string
  userId: string
  email?: string | null
  provider?: string
  event?: 'SIGNED_IN' | 'TOKEN_REFRESHED'
}): void {
  const user: CachedUser = {
    id: input.userId,
    email: input.email ?? null,
  }
  if (input.provider) user.provider = input.provider
  writeCachedUser(user)
  if (input.provider) rememberAuthProvider(input.provider)
  applyAuthAnalytics(input.userId, false)
  if (input.event === 'SIGNED_IN') {
    const method = authMethodFor(input.provider)
    if (method) track('auth_completed', { method })
  }
  set({ session: sessionFrom(input.token, user), loading: false })
}

export function clearWorkersSession(): void {
  writeCachedUser(null)
  clearWorkersBearer()
  applyAuthAnalytics(null, true)
  set({ session: null, loading: false })
}

let started: Promise<void> | null = null

export function startSessionStore(): Promise<void> {
  started ??= boot()
  return started
}

async function boot(): Promise<void> {
  const token = readWorkersBearer()
  if (!token) {
    set({ session: null, loading: false })
    return
  }
  const userId = cachedUserId()
  const cached = readCachedUser()
  if (userId) {
    applyAuthAnalytics(userId)
    const user: CachedUser = { id: userId, email: cached?.email ?? null }
    if (cached?.provider) user.provider = cached.provider
    set({
      session: sessionFrom(token, user),
      loading: false,
    })
  }
  await refreshFromNetwork()
}

/** Confirm the bearer against the Worker. Network failure keeps the held session. */
export async function refreshFromNetwork(): Promise<void> {
  const token = readWorkersBearer()
  if (!token) {
    if (state.session) clearWorkersSession()
    else if (state.loading) set({ session: null, loading: false })
    return
  }
  try {
    const { getWorkersSession } = await import('./authClient')
    const remote = await getWorkersSession()
    if (!remote) {
      // Definitive empty session — only drop if the server rejected us.
      return
    }
    applyWorkersSession({
      token,
      userId: remote.id,
      email: remote.email ?? null,
      ...(remote.provider ? { provider: remote.provider } : {}),
      event: 'TOKEN_REFRESHED',
    })
  } catch (err) {
    if (isAuthInvalidation(err)) {
      await forceReauth()
      return
    }
    if (state.loading) set({ loading: false })
  }
}
