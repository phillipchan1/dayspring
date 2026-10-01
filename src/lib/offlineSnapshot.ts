// Serve a surface's last good server read when the server cannot be reached.
//
// ── Why ──────────────────────────────────────────────────────────────────────
//
// Entries live in IndexedDB, so Pages and the editor work on a plane. Everything
// DERIVED from them — the Altar's threads, the rollups the Ascent reads, the
// Life Map — lives only on the server, and a surface that could not reach it
// showed an error (or, where a read was allowed to fail quietly, an empty state
// that read as "you have nothing here"). Offline, the parts of the journal that
// look back were simply gone.
//
// ── What this is, and is not ─────────────────────────────────────────────────
//
// Network first, always. `withOfflineSnapshot` runs the real read; when it
// succeeds the answer is returned AND photographed, and when it throws the last
// photograph is returned instead. So:
//
//   · online behaviour is unchanged — nothing here can make a surface staler
//     than it was, because a snapshot is never preferred to a live answer;
//   · offline, the surface shows what it showed last time it was open.
//
// It is not a sync engine. The derived tables carry no `updated_at` and no
// tombstones, so "pull what changed" cannot see a deletion; a photograph of the
// answer has no such blind spot.
//
// ── Privacy ──────────────────────────────────────────────────────────────────
//
// A snapshot is journal content. It is stamped with the owner it was read under
// and refused to anyone else, and it is scrubbed by the same `cacheClearAll`
// that scrubs the entries cache on sign-out / owner switch (lib/localData.ts).

import { CacheOwnerChangedError } from './asyncCache'
import { snapshotGet, snapshotPrune, snapshotPut } from './db'
import { readCacheOwner } from './localData'

/** Rows kept. A snapshot per opened page / strand adds up; the oldest go first. */
const KEEP = 400
/** A photograph older than this is not worth showing as "your Altar". */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

let pruned = false

async function remember(key: string, value: unknown): Promise<void> {
  const owner = readCacheOwner()
  if (!owner) return
  try {
    await snapshotPut({ key, owner, value, at: Date.now() })
    if (!pruned) {
      pruned = true
      await snapshotPrune(KEEP, MAX_AGE_MS)
    }
  } catch {
    // IndexedDB unavailable, quota, or a value that cannot be structured-cloned.
    // A snapshot is a convenience: failing to take one must never fail the read.
  }
}

async function recall<T>(key: string): Promise<{ value: T } | null> {
  try {
    const row = await snapshotGet(key)
    if (!row) return null
    if (row.owner !== readCacheOwner()) return null
    if (Date.now() - row.at > MAX_AGE_MS) return null
    return { value: row.value as T }
  } catch {
    return null
  }
}

/**
 * Run `load`. On success, return its answer and keep a copy under `key`. On
 * failure, return the last copy if there is one for this owner; otherwise
 * rethrow the original error, so a surface with nothing to show still shows its
 * own error state.
 *
 * `shouldKeep` lets a read decline to photograph an answer it knows is a
 * degraded one (a partial result composed while part of it failed).
 */
export async function withOfflineSnapshot<T>(
  key: string,
  load: () => Promise<T>,
  shouldKeep: (value: T) => boolean = () => true,
): Promise<T> {
  let value: T
  try {
    value = await load()
  } catch (err) {
    // Not a network failure: the reader changed. Their snapshot must not answer.
    if (err instanceof CacheOwnerChangedError) throw err
    const hit = await recall<T>(key)
    if (hit) return hit.value
    throw err
  }
  if (shouldKeep(value)) void remember(key, value)
  return value
}

/** Test seam: forget that this session already pruned. */
export function resetOfflineSnapshotForTests(): void {
  pruned = false
}
