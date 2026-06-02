// Offline-first entry repository.
//
// Writes go to the IndexedDB cache immediately (optimistic) and enqueue an
// outbox op; a background flush pushes them to Supabase. Reads come from the
// cache so the app opens instantly. sync() flushes pending writes then pulls
// the server, merging last-write-wins. Single user → conflicts are rare and
// "newest updated_at wins" is sufficient.

import {
  listAllEntries as serverListAll,
  upsertEntryRow,
  deleteEntry as serverDelete,
  wordCount,
} from './entries'
import * as cache from './db'
import { syncStore } from './sync'
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
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
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
  await flush()
  return entry
}

export async function updateEntryBody(id: string, body: string): Promise<Entry> {
  const base = await cache.cacheGet(id)
  const ts = nowISO()
  const entry: Entry = base
    ? { ...base, body_markdown: body, word_count: wordCount(body), updated_at: ts }
    : {
        id,
        created_at: ts,
        updated_at: ts,
        body_markdown: body,
        title: null,
        mood: null,
        tags: [],
        word_count: wordCount(body),
        source: 'native',
        external_id: null,
      }
  await cache.cachePut(entry)
  await queueUpsert(id)
  await flush()
  return entry
}

export async function removeEntry(id: string): Promise<void> {
  await cache.cacheDelete(id)
  await cache.outboxRemoveForEntry(id, 'upsert')
  await cache.outboxAdd({ opId: crypto.randomUUID(), kind: 'delete', entryId: id, ts: Date.now() })
  await refreshPending()
  await flush()
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

function entryMatchesRemote(local: Entry, remote: Entry): boolean {
  return local.updated_at === remote.updated_at && local.body_markdown === remote.body_markdown
}

/** Apply a remote row using the same last-write-wins rules as sync(). */
export async function mergeRemoteEntry(
  remote: Entry,
  preserveId?: string | null,
): Promise<'applied' | 'skipped'> {
  const ops = await cache.outboxAll()
  if (ops.some((o) => o.entryId === remote.id) || remote.id === preserveId) return 'skipped'

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
export async function mergeRemoteDelete(entryId: string): Promise<'applied' | 'skipped'> {
  const ops = await cache.outboxAll()
  if (ops.some((o) => o.entryId === entryId)) return 'skipped'

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

  const deletedIds: string[] = []
  const upserted: Entry[] = []

  for (const change of changes) {
    if (change.kind === 'delete') {
      if ((await mergeRemoteDelete(change.entryId)) === 'applied') {
        deletedIds.push(change.entryId)
      }
      continue
    }
    if ((await mergeRemoteEntry(change.entry, preserveId)) === 'applied') {
      const idx = upserted.findIndex((e) => e.id === change.entry.id)
      if (idx >= 0) upserted[idx] = change.entry
      else upserted.push(change.entry)
    }
  }

  return { deletedIds, upserted }
}

/**
 * Flush queued writes, then pull the server into the cache (last-write-wins).
 * `preserveId` keeps the actively-edited entry's local copy from being
 * overwritten mid-edit. Returns the merged list, or null when offline.
 */
export async function sync(preserveId?: string | null): Promise<Entry[] | null> {
  await flush()
  if (!navigator.onLine) return null
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
    // Local-only rows (e.g. created while offline, not yet pushed).
    for (const [id, local] of localMap) {
      if (!seen.has(id)) merged.push(local)
    }

    await cache.cachePutMany(merged)
    syncStore.setSynced(Date.now())
    return merged.sort((a, b) => b.created_at.localeCompare(a.created_at))
  } catch {
    syncStore.setOnline(false)
    return null
  }
}
