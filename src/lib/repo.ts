// Offline-first entry repository.
//
// Writes go to the IndexedDB cache immediately (optimistic) and enqueue an
// outbox op; a background flush pushes them to Supabase. Reads come from the
// cache so the app opens instantly. sync() flushes pending writes then pulls
// the server, merging last-write-wins. Single user → conflicts are rare and
// "newest updated_at wins" is sufficient.

import {
  listAllEntries as serverListAll,
  listEntriesSince as serverListSince,
  upsertEntryRow,
  deleteEntry as serverDelete,
  wordCount,
  byCreatedDesc,
} from './entries'
import * as cache from './db'
import { syncStore } from './sync'
import { isAuthInvalidation, forceReauth } from './authError'
import type { Entry, NewEntry } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

async function refreshPending(): Promise<void> {
  syncStore.setPending(await cache.outboxCount())
}

async function queueUpsert(entryId: string): Promise<void> {
  await cache.outboxRemoveForEntry(entryId, 'upsert')
  await cache.outboxAdd({ opId: crypto.randomUUID(), kind: 'upsert', entryId, ts: Date.now() })
  await refreshPending()
}

// ── reads ────────────────────────────────────────────────────────────────
export async function listEntries(): Promise<Entry[]> {
  const rows = await cache.cacheGetAll()
  return rows.sort(byCreatedDesc)
}

// ── writes (optimistic) ────────────────────────────────────────────────────
export async function createEntry(input: NewEntry): Promise<Entry> {
  const ts = nowISO()
  const entry: Entry = {
    id: crypto.randomUUID(),
    created_at: ts,
    updated_at: ts,
    body_markdown: input.body_markdown,
    title: input.title ?? null,
    mood: null,
    tags: input.tags ?? [],
    word_count: wordCount(input.body_markdown),
    source: 'native',
    external_id: null,
  }
  await cache.cachePut(entry)
  await queueUpsert(entry.id)
  scheduleFlush()
  return entry
}

export async function updateEntryBody(id: string, body: string): Promise<Entry> {
  const base = await cache.cacheGet(id)
  if (!base) throw new Error(`Entry ${id} not found in local cache — cannot update`)
  const ts = nowISO()
  const entry: Entry = { ...base, body_markdown: body, word_count: wordCount(body), updated_at: ts }
  await cache.cachePut(entry)
  await queueUpsert(id)
  scheduleFlush()
  return entry
}

export async function updateEntryDate(id: string, newCreatedAt: string): Promise<Entry> {
  const base = await cache.cacheGet(id)
  if (!base) throw new Error('Entry not found')
  const entry: Entry = { ...base, created_at: newCreatedAt, updated_at: nowISO() }
  await cache.cachePut(entry)
  await queueUpsert(id)
  scheduleFlush()
  return entry
}

/** Queue a delete locally; returns once IndexedDB/outbox are updated (no network wait). */
async function queueRemoveEntry(id: string): Promise<void> {
  await cache.cacheDelete(id)
  await cache.outboxRemoveForEntry(id, 'upsert')
  await cache.outboxAdd({ opId: crypto.randomUUID(), kind: 'delete', entryId: id, ts: Date.now() })
}

/** Optimistic delete — local cache + outbox immediately; server flush in background. */
export async function removeEntry(id: string): Promise<void> {
  await queueRemoveEntry(id)
  await refreshPending()
  void flush()
}

/** Batch optimistic deletes with a single background flush. */
export async function removeEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await Promise.all(ids.map((id) => queueRemoveEntry(id)))
  await refreshPending()
  void flush()
}

// ── sync ────────────────────────────────────────────────────────────────
/** Serializes outbox pushes so concurrent callers (autosave + sync + realtime) await the same run. */
let flushChain: Promise<void> = Promise.resolve()

async function flushOnce(): Promise<void> {
  if (!navigator.onLine) {
    syncStore.setOnline(false)
    return
  }
  for (const op of await cache.outboxAll()) {
    try {
      if (op.kind === 'upsert') {
        const row = await cache.cacheGet(op.entryId)
        if (row) await upsertEntryRow(row)
      } else {
        await serverDelete(op.entryId)
      }
      await cache.outboxRemove(op.opId)
    } catch {
      // Most likely offline / transient — stop and retry later.
      syncStore.setOnline(false)
      break
    }
  }
  syncStore.setOnline(navigator.onLine)
  await refreshPending()
}

export function flush(): Promise<void> {
  flushChain = flushChain.then(flushOnce, flushOnce)
  return flushChain
}

// Background push. Writes return after the local cache + outbox update — instant
// and offline-durable — and this drains the outbox to Supabase a moment later,
// coalescing a burst of autosaves into one round-trip instead of one per save
// (autosave fires ~every 0.6s while typing). An un-pushed write persists in the
// outbox, so if the timer hasn't fired it still goes out on the next flush()/
// sync() (focus, online, realtime, or app relaunch). Throttled, not debounced,
// so continuous typing still pushes within the window rather than starving.
let flushTimer: ReturnType<typeof setTimeout> | null = null
function scheduleFlush(delay = 1500): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, delay)
}

function entryMatchesRemote(local: Entry, remote: Entry): boolean {
  return local.updated_at === remote.updated_at && local.body_markdown === remote.body_markdown
}

/** Apply a remote row using the same last-write-wins rules as sync(). */
export async function mergeRemoteEntry(
  remote: Entry,
  preserveId?: string | null,
  pendingIds?: Set<string>,
): Promise<'applied' | 'skipped'> {
  const pending = pendingIds ?? new Set((await cache.outboxAll()).map((o) => o.entryId))
  if (pending.has(remote.id) || remote.id === preserveId) return 'skipped'

  const local = await cache.cacheGet(remote.id)
  if (local) {
    if (local.updated_at > remote.updated_at) return 'skipped'
    if (entryMatchesRemote(local, remote)) return 'skipped'
  }

  await cache.cachePut(remote)
  syncStore.setSynced(Date.now())
  return 'applied'
}

/** Apply a remote delete; skip echoes of our own deletes and in-flight local edits. */
export async function mergeRemoteDelete(
  entryId: string,
  pendingIds?: Set<string>,
): Promise<'applied' | 'skipped'> {
  const pending = pendingIds ?? new Set((await cache.outboxAll()).map((o) => o.entryId))
  if (pending.has(entryId)) return 'skipped'

  const local = await cache.cacheGet(entryId)
  if (!local) return 'skipped'

  await cache.cacheDelete(entryId)
  syncStore.setSynced(Date.now())
  return 'applied'
}

export type RemoteEntryChange =
  | { kind: 'delete'; entryId: string }
  | { kind: 'upsert'; entry: Entry }

export interface RemoteChangeResult {
  deletedIds: string[]
  upserted: Entry[]
}

/** Merge a burst of realtime events (bulk delete, import). Falls back to full sync when huge. */
export async function applyRemoteChanges(
  changes: RemoteEntryChange[],
  preserveId?: string | null,
): Promise<RemoteChangeResult | 'resync'> {
  if (changes.length >= 20) return 'resync'

  // Read the outbox once for the whole burst instead of per-event (was an N+1
  // of full `getAll('outbox')` reads, all awaited serially). The merge helpers
  // never touch the outbox, so a single snapshot is equivalent.
  const pendingIds = new Set((await cache.outboxAll()).map((o) => o.entryId))
  const deletedIds: string[] = []
  const upserted: Entry[] = []

  for (const change of changes) {
    if (change.kind === 'delete') {
      if ((await mergeRemoteDelete(change.entryId, pendingIds)) === 'applied') {
        deletedIds.push(change.entryId)
      }
      continue
    }
    if ((await mergeRemoteEntry(change.entry, preserveId, pendingIds)) === 'applied') {
      const idx = upserted.findIndex((e) => e.id === change.entry.id)
      if (idx >= 0) upserted[idx] = change.entry
      else upserted.push(change.entry)
    }
  }

  return { deletedIds, upserted }
}

// High-water mark of `updated_at` merged into the cache this session. Set by the
// full sync() and advanced by syncChanged(); null until the first full sync, so
// syncChanged() falls back to a full pull when it has no cursor yet.
let syncCursor: string | null = null

// When the last full reconcile ran. syncChanged() forces a full pull if it's been
// longer than this — bounds how stale a delete can get if the realtime socket
// silently dropped (a blip that fires no browser `offline` event), without making
// every refocus pay for a full pull.
let lastFullSyncAt = 0
const FULL_RECONCILE_INTERVAL_MS = 5 * 60_000

function maxUpdatedAt(rows: Entry[]): string | null {
  let max: string | null = null
  for (const r of rows) if (max === null || r.updated_at > max) max = r.updated_at
  return max
}

/**
 * Flush queued writes, then pull the WHOLE server library into the cache
 * (last-write-wins). This is the full reconcile — it's the only path that drops
 * rows deleted while the app was closed. Run on cold start, on reconnect, and on
 * a realtime burst overflow. `preserveId` keeps the actively-edited entry's local
 * copy from being overwritten mid-edit. Returns the merged list, or null offline.
 */
export async function sync(preserveId?: string | null): Promise<Entry[] | null> {
  await flush()
  if (!navigator.onLine) return null
  syncStore.setPulling(true)
  try {
    const server = await serverListAll()
    const localMap = new Map((await cache.cacheGetAll()).map((e) => [e.id, e]))
    const pending = new Set((await cache.outboxAll()).map((o) => o.entryId))
    const merged: Entry[] = []
    const seen = new Set<string>()

    for (const s of server) {
      seen.add(s.id)
      const local = localMap.get(s.id)
      const keepLocal =
        !!local && (pending.has(s.id) || s.id === preserveId || local.updated_at > s.updated_at)
      merged.push(keepLocal ? (local as Entry) : s)
    }
    // Local-only rows: keep ONLY if they have a pending outbox op (i.e. created
    // offline and not yet pushed). If a local entry is absent from the server AND
    // has no pending op, it was deleted by another client — drop it from the cache.
    for (const [id, local] of localMap) {
      if (!seen.has(id) && pending.has(id)) merged.push(local)
    }

    // Purge any local cache entries that are no longer in the merged set —
    // cachePutMany only writes, so without this explicit delete, server-side
    // deletes from other clients/apps are never reflected locally.
    const mergedIds = new Set(merged.map((e) => e.id))
    const toDelete = [...localMap.keys()].filter((id) => !mergedIds.has(id))
    if (toDelete.length) {
      await Promise.all(toDelete.map((id) => cache.cacheDelete(id)))
    }

    await cache.cachePutMany(merged)
    syncCursor = maxUpdatedAt(merged)
    lastFullSyncAt = Date.now()
    syncStore.setSynced(Date.now())
    return merged.sort(byCreatedDesc)
  } catch (e) {
    // A deleted/invalid user reads as a 401 here — recover to login rather than
    // masquerade as 'offline' showing stale cached data. Network errors fall
    // through to the offline path.
    if (isAuthInvalidation(e)) {
      void forceReauth()
      return null
    }
    syncStore.setOnline(false)
    return null
  } finally {
    syncStore.setPulling(false)
  }
}

/**
 * Lightweight refocus sync: pull only rows whose `updated_at` is newer than the
 * last sync, instead of the whole library — this is what makes tabbing back into
 * the app cheap (usually zero rows fetched, zero cache writes, no re-render).
 *
 * Deletes are invisible to an `updated_at` query, so this does NOT drop deleted
 * rows. That's intentional and safe for its callers: it only runs while the app
 * has been open (focus / visibility), during which the realtime channel has
 * already applied any deletes. Cold start and reconnect use the full sync()
 * instead. Falls back to a full sync() when there's no cursor yet.
 *
 * Returns the full current list when something changed (so the caller replaces
 * its entries), or null when nothing changed / offline (caller skips — no churn).
 */
export async function syncChanged(preserveId?: string | null): Promise<Entry[] | null> {
  if (syncCursor === null || Date.now() - lastFullSyncAt > FULL_RECONCILE_INTERVAL_MS) {
    return sync(preserveId)
  }
  await flush()
  if (!navigator.onLine) return null
  syncStore.setPulling(true)
  try {
    const changed = await serverListSince(syncCursor)
    syncStore.setSynced(Date.now())
    if (changed.length === 0) return null

    const pending = new Set((await cache.outboxAll()).map((o) => o.entryId))
    const toPut: Entry[] = []
    for (const s of changed) {
      const local = await cache.cacheGet(s.id)
      const keepLocal =
        !!local && (pending.has(s.id) || s.id === preserveId || local.updated_at > s.updated_at)
      if (!keepLocal) toPut.push(s)
    }
    const newMax = maxUpdatedAt(changed)
    if (newMax && newMax > syncCursor) syncCursor = newMax

    // Everything the server returned was our own echo / already-newer-local —
    // nothing to write, so don't churn the list.
    if (toPut.length === 0) return null
    await cache.cachePutMany(toPut)
    return (await cache.cacheGetAll()).sort(byCreatedDesc)
  } catch (e) {
    if (isAuthInvalidation(e)) {
      void forceReauth()
      return null
    }
    syncStore.setOnline(false)
    return null
  } finally {
    syncStore.setPulling(false)
  }
}
