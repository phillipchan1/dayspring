// Reading and writing the app lock: `profiles.app_lock` for the account, plus a
// localStorage mirror for the two things the network can't do.
//
// The mirror earns its keep twice. First, latency: the gate has to be up before
// anything of the journal paints, and a round trip to Supabase on every cold
// launch would mean a visible flash of content or a spinner in front of every
// single launch. Second, offline: a phone in airplane mode must still take the
// PIN and open.
//
// The account row stays the source of truth. The mirror is refreshed from it on
// every successful read, and stamped with the owner it belongs to — the gate
// runs ABOVE `fenceCacheToOwner` in the tree, so it cannot assume the fence has
// already scrubbed a previous user's mirror and has to check for itself.

import { requireSupabase } from './supabase'
import { isAppLockConfig, type AppLockConfig } from './appLock'

const MIRROR_KEY = 'dayspring.applock'
const RESET_MARKER_KEY = 'dayspring.applock.reset'

type Mirror = {
  owner: string
  /** null records "this account has no lock" — a real answer, not a miss. */
  config: AppLockConfig | null
  fetchedAt: string
}

/**
 * The locally cached lock for `ownerId`, or undefined when we have no answer
 * for this account.
 *
 * Note the three-way return. `null` (the account has no lock) and `undefined`
 * (we don't know yet) have to stay distinguishable: the first opens the app
 * immediately, the second has to go and ask before anything renders.
 */
export function readMirror(ownerId: string): AppLockConfig | null | undefined {
  try {
    const raw = localStorage.getItem(MIRROR_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<Mirror>
    if (parsed.owner !== ownerId) return undefined
    if (parsed.config === null) return null
    return isAppLockConfig(parsed.config) ? parsed.config : undefined
  } catch {
    return undefined
  }
}

export function writeMirror(ownerId: string, config: AppLockConfig | null): void {
  try {
    const mirror: Mirror = { owner: ownerId, config, fetchedAt: new Date().toISOString() }
    localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror))
  } catch {
    /* quota / private mode — the account row still answers, just not offline */
  }
}

export function clearMirror(): void {
  try {
    localStorage.removeItem(MIRROR_KEY)
  } catch {
    /* ignore */
  }
}

// ── The live value, shared ──────────────────────────────────────────────────
//
// Two places need the same answer at the same time: the gate, which verifies
// against it, and Settings, which edits it. Without a shared store the gate goes
// on holding the config it read at launch, so changing your PIN in Settings
// leaves the *old* PIN opening the app until the next relaunch — a stale
// security control, which is worse than a missing one.
//
// Same shape as `settingsStore`: a value, a listener set, and no framework.

let current: AppLockConfig | null | undefined
const listeners = new Set<() => void>()

export const lockState = {
  get(): AppLockConfig | null | undefined {
    return current
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  set(next: AppLockConfig | null | undefined): void {
    current = next
    for (const l of listeners) l()
  },
  /** Set without notifying — for the gate's first synchronous read, which
   *  happens during render when there is nobody subscribed yet. */
  seed(next: AppLockConfig | null | undefined): void {
    current = next
  },
}

/**
 * Read the account's lock.
 *
 * Returns null when the account genuinely has no lock, and THROWS when the
 * fetch failed — the same distinction `loadRemoteSettings` draws, for the same
 * reason: a device that can't reach the server must not conclude "no lock" and
 * open the journal.
 */
export async function getAppLock(): Promise<AppLockConfig | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('profiles').select('app_lock').maybeSingle()
  if (error) throw error
  const value = data?.app_lock
  if (!value) return null
  // An unrecognised shape is not "no lock". Report it as a lock we can't verify
  // against so the gate stays shut rather than opening on a parse failure.
  if (!isAppLockConfig(value)) throw new Error('app_lock: unrecognised config shape')
  return value
}

/** Persist a lock for the signed-in account, and refresh the mirror. */
export async function saveAppLock(config: AppLockConfig): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('app_lock: not signed in')
  await sb
    .from('profiles')
    .upsert({ owner: session.user.id, app_lock: config }, { onConflict: 'owner' })
    .throwOnError()
  writeMirror(session.user.id, config)
  lockState.set(config)
}

/** Turn the lock off for the account, and clear the mirror. */
export async function clearAppLock(): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('app_lock: not signed in')
  await sb
    .from('profiles')
    .upsert({ owner: session.user.id, app_lock: null }, { onConflict: 'owner' })
    .throwOnError()
  writeMirror(session.user.id, null)
  lockState.set(null)
}

// ── Forgotten PIN ──────────────────────────────────────────────────────────
//
// There is no server-side password to email, because the PIN is never sent
// anywhere. What proves the account is the account is the thing that already
// does: signing in again with Google or Apple. So "Forgot your PIN?" leaves a
// marker, signs out, and the next successful sign-in as the SAME account clears
// the lock.
//
// The marker is deliberately not owner-scoped in `localData.ts`: it has to
// survive the sign-out it triggers. It carries the owner id instead, so a
// different account signing in on this device can't consume it.

export function markResetRequested(ownerId: string): void {
  try {
    localStorage.setItem(RESET_MARKER_KEY, ownerId)
  } catch {
    /* ignore — the user can retry from the lock screen */
  }
}

function readResetMarker(): string | null {
  try {
    return localStorage.getItem(RESET_MARKER_KEY)
  } catch {
    return null
  }
}

/** Cheap synchronous check, so the gate's fast path stays free. Only when this
 *  is true is it worth going to the server. */
export function hasResetMarker(ownerId: string): boolean {
  return readResetMarker() === ownerId
}

export function clearResetMarker(): void {
  try {
    localStorage.removeItem(RESET_MARKER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * If this sign-in is the return leg of a "Forgot your PIN?" reset for this same
 * account, drop the lock. Returns true when it cleared one.
 *
 * Best-effort by design: if the write fails the marker stays put and the next
 * launch tries again, which is better than consuming the user's only way back
 * in on a flaky connection.
 */
export async function consumeResetIfRequested(ownerId: string): Promise<boolean> {
  if (readResetMarker() !== ownerId) return false
  await clearAppLock()
  clearResetMarker()
  return true
}
