// Offline-first entry repository.
//
// Writes go to the IndexedDB cache immediately (optimistic) and enqueue an
// outbox op; a background flush pushes them to Supabase. Reads come from the
// cache so the app opens instantly. sync() flushes pending writes then pulls
// the server, merging last-write-wins. Single user → conflicts are rare and
// "newest updated_at wins" is sufficient.

import {
  listEntries as serverList,
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
  void flush()
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
  void flush()
  return entry
}

export async function removeEntry(id: string): Promise<void> {
  await cache.cacheDelete(id)
  await cache.outboxRemoveForEntry(id, 'upsert')
  await cache.outboxAdd({ opId: crypto.randomUUID(), kind: 'delete', entryId: id, ts: Date.now() })
  await refreshPending()
  void flush()
}

// ── sync ────────────────────────────────────────────────────────────────
let flushing = false

export async function flush(): Promise<void> {
  if (flushing) return
  if (!navigator.onLine) {
    syncStore.setOnline(false)
    return
  }
  flushing = true
  try {
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
  } finally {
    flushing = false
    await refreshPending()
  }
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
    const server = await serverList(500)
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
