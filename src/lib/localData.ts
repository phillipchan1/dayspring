import { cacheClearAll, outboxCount } from './db'
import { clearAllCache } from './asyncCache'

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
    // cache only when there are no pending writes to lose — never drop a real
    // user's unsynced edits during the upgrade. Sign-out already scrubs content,
    // so a non-empty outbox here is almost always the current user's own.
    const pending = await outboxCount().catch(() => 0)
    if (pending === 0) await purgeContent()
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
