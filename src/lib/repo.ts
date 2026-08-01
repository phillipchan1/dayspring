// Offline-first entry repository.
//
// Writes go to the IndexedDB cache immediately (optimistic) and enqueue an
// outbox op; a background flush pushes them to Supabase. Reads come from the
// cache so the app opens instantly. sync() flushes pending writes then pulls
// the server.
//
// Reconciling is last-write-wins with one hard rule: a write is never destroyed.
// `updated_at` is the server's clock and only the server's, so the comparison is
// meaningful across devices; a push declares the version it was based on, and
// the server refuses to overwrite anything newer. When two devices really have
// edited the same entry, the device being typed on keeps it and the other
// version is preserved as its own entry rather than discarded.

import {
  listAllEntries as serverListAll,
  listEntriesSince as serverListSince,
  upsertEntryChecked,
  deleteEntry as serverDelete,
  wordCount,
  byCreatedDesc,
} from './entries'
import * as cache from './db'
import { syncStore } from './sync'
import { isAuthInvalidation, forceReauth } from './authError'
import { maxUpdatedAt, shouldAdoptServerRow, shouldApplyRemote, subsumes } from './entryVersion'
import { classifySyncError, describeSyncError, MAX_SYNC_ATTEMPTS } from './syncError'
import type { Entry, NewEntry } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

async function refreshPending(): Promise<void> {
  const ops = await cache.outboxAll()
  // `pending` counts the user's writing still in flight. A queued `derive` is
  // bookkeeping that follows a push already landed, so counting it would double
  // the number the badge shows for every single save.
  const pending = ops.filter((o) => !o.quarantined && o.kind !== 'derive').length
  syncStore.setQueue({ pending, blocked: ops.filter((o) => o.quarantined).length })
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
/**
 * `id` lets the caller pre-allocate the row id (autosave drafts mint one per
 * editing session). Creation is then idempotent end-to-end: cachePut overwrites
 * by key, the outbox dedups per entry, and the server push is an upsert — so
 * racing flushes converge on ONE row instead of inserting duplicates.
 */
export async function createEntry(input: NewEntry, id?: string): Promise<Entry> {
  const ts = nowISO()
  const entry: Entry = {
    id: id ?? crypto.randomUUID(),
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

/**
 * A local edit bumps `local_edited_at` and deliberately leaves `updated_at`
 * alone. That column stays exactly what the server last told us, which is what
 * makes it both safely comparable against other devices and usable as the base
 * an optimistic-concurrency push checks against. See lib/entryVersion.ts.
 */
function locallyEdited(base: Entry, patch: Partial<Entry>): Entry {
  return { ...base, ...patch, local_edited_at: Date.now() }
}

export async function updateEntryBody(id: string, body: string): Promise<Entry> {
  const base = await cache.cacheGet(id)
  if (!base) throw new Error(`Entry ${id} not found in local cache — cannot update`)
  const entry = locallyEdited(base, { body_markdown: body, word_count: wordCount(body) })
  await cache.cachePut(entry)
  await queueUpsert(id)
  scheduleFlush()
  return entry
}

export async function updateEntryDate(id: string, newCreatedAt: string): Promise<Entry> {
  const base = await cache.cacheGet(id)
  if (!base) throw new Error('Entry not found')
  const entry = locallyEdited(base, { created_at: newCreatedAt })
  await cache.cachePut(entry)
  await queueUpsert(id)
  scheduleFlush()
  return entry
}

/**
 * Notified when the repo changes cached bodies on its own initiative rather than
 * in response to the user — today, a photo queued offline finally uploading and
 * its placeholder resolving. Without this the open editor keeps showing a
 * pending photo that has actually arrived.
 */
const localChangeListeners = new Set<(entryIds: string[]) => void>()
export function onLocalEntryChange(cb: (entryIds: string[]) => void): () => void {
  localChangeListeners.add(cb)
  return () => localChangeListeners.delete(cb)
}

/**
 * Rewrite the body of whichever cached entry `match` selects, and queue the
 * result. Used to resolve a photo placeholder once its upload finally lands —
 * which may be long after the entry was closed, so this deliberately works on
 * the cache rather than the editor. Returns the ids it touched.
 *
 * `transform` must return the body unchanged when it has nothing to do; an
 * identical body is skipped so this can never queue a no-op write.
 */
export async function rewriteEntryBodies(
  match: (entry: Entry) => boolean,
  transform: (body: string) => string,
): Promise<string[]> {
  const touched: string[] = []
  for (const entry of await cache.cacheGetAll()) {
    if (!match(entry)) continue
    const body = transform(entry.body_markdown)
    if (body === entry.body_markdown) continue
    await cache.cachePut(locallyEdited(entry, { body_markdown: body, word_count: wordCount(body) }))
    await queueUpsert(entry.id)
    touched.push(entry.id)
  }
  if (touched.length) {
    scheduleFlush()
    for (const listener of localChangeListeners) listener(touched)
  }
  return touched
}

/** Queue a delete locally; returns once IndexedDB/outbox are updated (no network wait). */
async function queueRemoveEntry(id: string): Promise<void> {
  await cache.cacheDelete(id)
  await cache.outboxRemoveForEntry(id, 'upsert')
  // Nothing left to derive from; the delete op supersedes it.
  await cache.outboxRemoveForEntry(id, 'derive')
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

/**
 * Rebuilds the rows derived from an entry's body (prayers, scripture refs).
 * Injected rather than imported so the repo stays free of feature modules.
 */
type EntryDeriveHook = (entry: Entry) => Promise<void>
let deriveHook: EntryDeriveHook | null = null

/**
 * Register how derived rows are rebuilt. Set once at boot; without it, `derive`
 * ops drain harmlessly as no-ops.
 *
 * Derivation used to run inline on every autosave, straight to Supabase, with
 * its rejection swallowed. Offline that meant the entry body synced later but
 * the prayer or scripture reference in it never existed anywhere — the Altar,
 * Scripture and Concordance quietly omitted something the user had written, on
 * every device, permanently. Routing it through the outbox makes it durable.
 */
export function setEntryDeriveHook(hook: EntryDeriveHook | null): void {
  deriveHook = hook
}

/**
 * Extra queued work drained alongside the outbox — currently photo uploads that
 * failed offline. Injected for the same reason as the derive hook: the repo
 * knows when the network is worth trying, but not what else is waiting on it.
 */
let sideQueueHook: (() => Promise<void>) | null = null
export function setSideQueueHook(hook: (() => Promise<void>) | null): void {
  sideQueueHook = hook
}

/** Queue a rebuild of an entry's derived rows (deduped per entry). */
async function queueDerive(entryId: string): Promise<void> {
  await cache.outboxRemoveForEntry(entryId, 'derive')
  await cache.outboxAdd({ opId: crypto.randomUUID(), kind: 'derive', entryId, ts: Date.now() })
}

/**
 * Copy the losing side of a conflict into its own entry, so a simultaneous edit
 * on two devices costs the user nothing.
 *
 * The device being typed on keeps the entry — interrupting someone mid-sentence
 * to adjudicate a merge would be worse than the problem. The version that loses
 * is written to a new row carrying the SAME `created_at`, so it lands on the
 * right day in the journal and can be read, compared and merged by hand later.
 * The text is copied verbatim; nothing is annotated into the user's words.
 */
async function preserveLosingVersion(local: Entry, server: Entry): Promise<void> {
  if (subsumes(local.body_markdown, server.body_markdown)) return
  const shadow: Entry = {
    ...server,
    id: crypto.randomUUID(),
    // A fresh row of our own: never inherit the import-dedup identity.
    source: 'native',
    external_id: null,
  }
  // Server rows never carry it, but the shadow must not start life looking like
  // it holds unpushed local edits.
  delete shadow.local_edited_at
  await cache.cachePut(shadow)
  await queueUpsert(shadow.id)
}

// A conflict is resolved by rebasing and pushing again. Bounded because each
// retry is a fresh race; in practice it settles on the first.
const MAX_CONFLICT_REBASES = 3

/**
 * Push one row to the server and adopt the copy it hands back.
 *
 * Two things happen here that the old blind upsert did not.
 *
 * Adopting the returned row: the server owns `updated_at`, so until its answer
 * is written back the cache holds a timestamp from THIS device's clock while
 * every other device holds one from the server's. Weighing those two against
 * each other in last-write-wins is how a device with a fast clock ends up
 * permanently ignoring another device's newer edits.
 *
 * Checking the base: the push declares which version it was made from, and the
 * server refuses to overwrite anything newer. Without that, two devices editing
 * one entry meant the later push silently destroyed the earlier one's writing.
 */
async function pushEntry(row: Entry): Promise<void> {
  let attempt = row
  for (let i = 0; i < MAX_CONFLICT_REBASES; i++) {
    const { conflicted, entry: server } = await upsertEntryChecked(attempt, attempt.updated_at)
    if (!conflicted) {
      // Skip if the row changed while the push was in flight — that edit queued
      // its own op and adopts the server's answer on its own push.
      if (shouldAdoptServerRow(row, await cache.cacheGet(row.id))) await cache.cachePut(server)
      return
    }
    await preserveLosingVersion(attempt, server)
    // Retry from their version as the base, now that theirs is safe.
    attempt = { ...attempt, updated_at: server.updated_at }
  }
  // Still racing after several rounds. Leave the op queued rather than force the
  // write: the next flush retries, and nothing has been lost either way.
  throw new Error('entry push kept conflicting — will retry')
}

async function flushOnce(): Promise<void> {
  if (!navigator.onLine) {
    syncStore.setOnline(false)
    return
  }
  let reachedServer = true
  // Queue order, not `getAll`'s random-UUID order — see cache.outboxAllOrdered.
  for (const op of await cache.outboxAllOrdered()) {
    if (op.quarantined) continue
    try {
      if (op.kind === 'upsert') {
        const row = await cache.cacheGet(op.entryId)
        if (row) {
          await pushEntry(row)
          // Derive only once the body is safely on the server, so the derived
          // rows can never describe an entry the server doesn't have yet.
          await queueDerive(op.entryId)
        }
      } else if (op.kind === 'derive') {
        const row = await cache.cacheGet(op.entryId)
        if (row && deriveHook) await deriveHook(row)
      } else {
        await serverDelete(op.entryId)
      }
      await cache.outboxRemove(op.opId)
    } catch (e) {
      const failure = classifySyncError(e)
      if (failure === 'permanent') {
        // The server will never accept this one. Retire it and keep draining —
        // letting it sit at the head of the queue used to block every write
        // behind it indefinitely, with the UI reporting "Offline" on a device
        // that was online.
        await cache.outboxMarkFailure(op.opId, { quarantine: true, error: describeSyncError(e) })
        continue
      }
      // 'offline' costs nothing to retry and must not burn an attempt, or a long
      // flight would quarantine perfectly good writes.
      if (failure === 'offline') {
        reachedServer = false
      } else {
        const attempts = (op.attempts ?? 0) + 1
        await cache.outboxMarkFailure(op.opId, {
          quarantine: attempts >= MAX_SYNC_ATTEMPTS,
          error: describeSyncError(e),
        })
      }
      break
    }
  }
  syncStore.setOnline(reachedServer && navigator.onLine)
  await refreshPending()
  if (reachedServer && sideQueueHook) {
    // Never let a stuck photo upload fail the entry flush.
    await sideQueueHook().catch(() => {})
  }
  // Derives queued by the pushes above landed after this drain's snapshot was
  // taken; pick them up promptly rather than waiting on the heartbeat.
  if (reachedServer && (await cache.outboxHasKind('derive'))) scheduleFlush()
}

export function flush(): Promise<void> {
  flushChain = flushChain.then(flushOnce, flushOnce)
  return flushChain
}

/**
 * Un-retire quarantined ops and drain again. An explicit "sync now" from the user
 * is the one signal worth acting on: whatever the server objected to may well
 * have been fixed since, and each of those ops still holds a write they made.
 */
export async function retryBlocked(): Promise<void> {
  await cache.outboxClearQuarantine()
  await flush()
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

/** Apply a remote row using the same last-write-wins rules as sync(). */
export async function mergeRemoteEntry(
  remote: Entry,
  preserveId?: string | null,
  pendingIds?: Set<string>,
): Promise<'applied' | 'skipped'> {
  const pending = pendingIds ?? new Set((await cache.outboxAll()).map((o) => o.entryId))
  const local = await cache.cacheGet(remote.id)
  const apply = shouldApplyRemote(remote, local, {
    pending: pending.has(remote.id),
    preserved: remote.id === preserveId,
  })
  if (!apply) return 'skipped'

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

/** Effective changes at or above this count are cheaper to reconcile in one pull. */
const RESYNC_BURST_THRESHOLD = 20

/**
 * Merge a burst of realtime events (bulk delete, import), falling back to a full
 * sync when there are genuinely many.
 *
 * The count that decides is of *effective* changes, not raw events. A server-side
 * backfill emits an event per entry while changing nothing the client can see, and
 * counting those raw meant one backfill sent every connected device — phones on
 * cell data included — into a full library download for no reason.
 *
 * One `cacheGetAll` and one outbox read serve the whole burst; this used to do a
 * `cacheGet` and a full `getAll('outbox')` per event, awaited serially.
 */
export async function applyRemoteChanges(
  changes: RemoteEntryChange[],
  preserveId?: string | null,
): Promise<RemoteChangeResult | 'resync'> {
  const localMap = new Map((await cache.cacheGetAll()).map((e) => [e.id, e]))
  const pendingIds = new Set((await cache.outboxAll()).map((o) => o.entryId))

  const effective = changes.filter((change) =>
    change.kind === 'delete'
      ? localMap.has(change.entryId) && !pendingIds.has(change.entryId)
      : shouldApplyRemote(change.entry, localMap.get(change.entry.id), {
          pending: pendingIds.has(change.entry.id),
          preserved: change.entry.id === preserveId,
        }),
  )
  if (effective.length === 0) return { deletedIds: [], upserted: [] }
  if (effective.length >= RESYNC_BURST_THRESHOLD) return 'resync'

  const deletedIds: string[] = []
  const upserted: Entry[] = []

  for (const change of effective) {
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

    // `pending` was sampled before the (slow) server fetch. An entry created
    // since — or one whose outbox op the 1.5s flush timer drained in between —
    // is in neither the server snapshot nor that stale set, so the purge below
    // would delete it from under the user. Re-read the outbox and rescue those,
    // plus the entry on screen, which is never purged here.
    const mergedIds = new Set(merged.map((e) => e.id))
    const stillPending = new Set((await cache.outboxAll()).map((o) => o.entryId))
    for (const [id, local] of localMap) {
      if (mergedIds.has(id)) continue
      if (!stillPending.has(id) && id !== preserveId) continue
      merged.push(local)
      mergedIds.add(id)
    }

    // Purge whatever is left — cachePutMany only writes, so without this explicit
    // delete, deletes made on another device are never reflected locally.
    const toDelete = [...localMap.keys()].filter((id) => !mergedIds.has(id))
    if (toDelete.length) {
      await Promise.all(toDelete.map((id) => cache.cacheDelete(id)))
    }

    await cache.cachePutMany(merged)
    // From the SERVER rows, never `merged`: a local row still carries this
    // device's clock until its push adopts the server's timestamp, so a fast
    // clock would push the cursor into the future and blind `listEntriesSince`
    // until the next full reconcile.
    syncCursor = maxUpdatedAt(server)
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
