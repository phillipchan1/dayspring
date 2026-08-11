import { cacheClearAll, dictationCount, outboxCount, pendingUploadCount } from './db'
import { clearAllCache } from './asyncCache'
import { SUBSCRIPTION_CACHE_KEY } from './subscription'

// Privacy fence for a shared browser. The IndexedDB cache + outbox and the
// in-memory surface caches hold journal CONTENT; if a second person signs in on
// the same browser they must never see the first person's data. We scrub content
// on sign-out and whenever the signed-in owner changes. Onboarding flags are NOT
// content, so they survive a same-user sign-out/in (no re-onboarding) and are
// reset only on a confirmed *different* owner.

const CACHE_OWNER_KEY = 'dayspring.cache_owner'

// Onboarding/preference flags reset only when a DIFFERENT user takes over the
// browser (so user B doesn't inherit user A's "welcome seen" / settings).
const OWNER_SCOPED_FLAGS = [
  'dayspring.has_seen_welcome',
  'dayspring.settings.v1',
  'dayspring.scriptureScannedImported',
  SUBSCRIPTION_CACHE_KEY,
]

/** Scrub all cached journal CONTENT (privacy-sensitive). */
export async function purgeContent(): Promise<void> {
  clearAllCache()
  try {
    await cacheClearAll()
  } catch {
    /* idb unavailable — nothing to scrub */
  }
}

function purgeFlags(): void {
  for (const key of OWNER_SCOPED_FLAGS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

function readCacheOwner(): string | null {
  try {
    return localStorage.getItem(CACHE_OWNER_KEY)
  } catch {
    return null
  }
}

function writeCacheOwner(ownerId: string): void {
  try {
    localStorage.setItem(CACHE_OWNER_KEY, ownerId)
  } catch {
    /* ignore */
  }
}

/**
 * Ensure the local cache belongs to `ownerId`. Same owner → fast no-op. Unknown
 * owner (first load / pre-fence rollout) → scrub content only (re-syncs from the
 * server; keeps the user's onboarding flags). Confirmed different owner → scrub
 * content AND reset flags. Call this on boot before any cache read.
 */
export async function fenceCacheToOwner(ownerId: string): Promise<void> {
  const stored = readCacheOwner()
  if (stored === ownerId) return // same owner — fast path, nothing to do

  if (stored && stored !== ownerId) {
    // Confirmed different user took over this browser → full scrub + flag reset.
    await purgeContent()
    purgeFlags()
  } else {
    // Unknown prior owner (first load, or pre-fence rollout). Scrub the read
    // cache only when there is no unsynced work to lose — never drop a real
    // user's own data during the upgrade. Sign-out already scrubs content, so
    // anything queued here is almost always the current user's.
    //
    // Counts all three queues, not just the outbox: purgeContent() clears the
    // dictation and pending-upload stores too, and those hold the ONLY copy of
    // an un-transcribed recording or a photo added offline.
    const pending = await Promise.all([
      outboxCount().catch(() => 0),
      dictationCount().catch(() => 0),
      pendingUploadCount().catch(() => 0),
    ])
    if (pending.every((n) => n === 0)) await purgeContent()
  }
  writeCacheOwner(ownerId)
}

/** On sign-out: scrub content and forget the owner so the next login re-fences. */
export async function purgeOnSignOut(): Promise<void> {
  await purgeContent()
  try {
    localStorage.removeItem(CACHE_OWNER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * After the account itself has been deleted: scrub everything, flags included.
 *
 * Sign-out deliberately keeps the owner-scoped flags — same person, same
 * browser, no reason to make them sit through the welcome again. Account
 * deletion has no same person to come back, and "your journal is gone" has to
 * be true of this device too, down to the cached plan and the settings.
 */
export async function purgeAfterAccountDeletion(): Promise<void> {
  await purgeOnSignOut()
  purgeFlags()
}
