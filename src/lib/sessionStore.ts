import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase, hasAuthCallbackInUrl } from './supabase'
import { authStorage } from './authStorage'
import { isAuthInvalidation, forceReauth } from './authError'
import { rememberAuthProvider } from './lastAuthProvider'
import { applyAuthAnalytics, track } from './analytics'

// The ONE answer to "who is signed in on this device", shared by every caller.
//
// Offline first. The signed-in person is whoever's session is on disk — read
// straight from storage at boot, not asked of Supabase. Asking Supabase means
// waiting for it to refresh an expired access token, and offline it retries
// that refresh with backoff for ~25s, several times over, before answering
// "nobody". That was the long splash, and the "nobody" dropped a paying user
// into guest mode, whose privacy fence then purged their journal and outbox.
//
// An expired access token is not a signed-out person. Only an explicit
// SIGNED_OUT (our sign-out, or Supabase rejecting the refresh token outright)
// ends the session. Every API call still gets its token through supabase-js,
// which refreshes it once the network is back, so nothing here ever sends a
// stale JWT.
//
// Previously each useSession() call subscribed on its own and started at
// `session: null`. useSubscription saw that null on its first render and
// wiped the cached plan; offline, the refetch then failed and "no plan" stuck —
// "your trial has ended" for a paying subscriber.

export interface SessionState {
  session: Session | null
  /** True only until the stored session has been read — a few milliseconds. */
  loading: boolean
}

let state: SessionState = { session: null, loading: true }
const listeners = new Set<() => void>()
/** Set once Supabase has given a definitive answer (a session, or a sign-out),
 *  so the boot read never overwrites it with the older value on disk. */
let heardFromAuth = false

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

/**
 * A persisted Supabase session, or null if the value isn't one. The access
 * token's expiry is deliberately NOT checked: a session whose token lapsed
 * while the device was offline still belongs to the person who owns it.
 */
export function parseStoredSession(raw: unknown): Session | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const s = value as Partial<Session>
  if (typeof s.access_token !== 'string' || typeof s.refresh_token !== 'string') return null
  // No refresh token, no way back to the server — not a session worth keeping.
  if (!s.refresh_token) return null
  if (!s.user || typeof s.user.id !== 'string' || !s.user.id) return null
  return s as Session
}

function storageKeyOf(sb: SupabaseClient): string {
  return (sb.auth as unknown as { storageKey: string }).storageKey
}

/** The session on disk (Tauri store on native, localStorage on web). */
export async function readStoredSession(): Promise<Session | null> {
  const sb = supabase
  if (!sb) return null
  try {
    const key = storageKeyOf(sb)
    const raw = authStorage ? await authStorage.getItem(key) : window.localStorage.getItem(key)
    return parseStoredSession(raw)
  } catch {
    return null
  }
}

export type SessionDecision =
  /** Take this value. */
  | { session: Session | null }
  /** Nothing to change. */
  | 'keep'
  /** Supabase answered "no session" while we hold one. Offline, that means a
   *  refresh failed and the session is still on disk — look before dropping it. */
  | 'recheck-storage'

/** What an auth event means for the session the app is running on. */
export function decideSession(
  event: AuthChangeEvent,
  incoming: Session | null,
  current: Session | null,
): SessionDecision {
  if (incoming) return { session: incoming }
  if (event === 'SIGNED_OUT') return { session: null }
  if (!current) return 'keep'
  return 'recheck-storage'
}

/**
 * Confirm a restored session against the server. On a definitive rejection
 * (deleted or disabled account — never a network failure) sign out.
 */
function validateUser(sb: SupabaseClient): void {
  void sb.auth.getUser().then(({ error }) => {
    if (error && isAuthInvalidation(error)) void forceReauth()
  })
}

function onAuthEvent(sb: SupabaseClient, event: AuthChangeEvent, next: Session | null): void {
  // Remember which button worked, so the sign-in screen can remind this
  // device next time instead of letting it start a second account.
  if (next) rememberAuthProvider(next.user?.app_metadata?.provider)

  // Join this device's anonymous PostHog person to the account. Only an
  // explicit sign-out resets; a null from a failed offline refresh is not one.
  if (next || event === 'SIGNED_OUT') applyAuthAnalytics(next?.user?.id ?? null, event === 'SIGNED_OUT')

  // Only a genuine interactive sign-in, never a restored/refreshed session.
  if (event === 'SIGNED_IN' && next) {
    const method = authMethodFor(next.user?.app_metadata?.provider)
    if (method) track('auth_completed', { method })
  }

  if (event === 'INITIAL_SESSION' && next) validateUser(sb)

  const decision = decideSession(event, next, state.session)
  if (decision === 'keep') {
    if (state.loading) set({ loading: false })
    return
  }
  if (decision === 'recheck-storage') {
    void readStoredSession().then((stored) => {
      if (!stored) set({ session: null, loading: false })
    })
    return
  }
  heardFromAuth = true
  set({ session: decision.session, loading: false })
}

/** Narrows the untyped `app_metadata.provider` to the closed vocabulary
 *  `auth_completed` is allowed to carry. */
function authMethodFor(provider: unknown): 'apple' | 'google' | 'email' | null {
  return provider === 'apple' || provider === 'google' || provider === 'email' ? provider : null
}

let started: Promise<void> | null = null

/**
 * Start listening and settle the session. Awaited once in main.tsx before the
 * first render; resolves as soon as the stored session has been read — never
 * on the network, except for an OAuth / magic-link return, where the session
 * only exists once the code has been exchanged.
 */
export function startSessionStore(): Promise<void> {
  started ??= boot()
  return started
}

async function boot(): Promise<void> {
  const sb = supabase
  if (!sb) {
    set({ session: null, loading: false })
    return
  }

  sb.auth.onAuthStateChange((event, next) => onAuthEvent(sb, event, next))

  if (hasAuthCallbackInUrl()) {
    const { data } = await sb.auth.getSession()
    if (!heardFromAuth) set({ session: data.session, loading: false })
    return
  }

  const stored = await readStoredSession()
  if (heardFromAuth) {
    if (state.loading) set({ loading: false })
    return
  }
  if (stored) applyAuthAnalytics(stored.user.id)
  set({ session: stored, loading: false })
}
