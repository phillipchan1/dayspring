import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Entry } from './types'

export interface OutboxOp {
  opId: string
  kind: 'upsert' | 'delete'
  entryId: string
  ts: number
}

/** One cached display-sized image blob, keyed by `<hash>.<ext>`. */
export interface AttBlobRow {
  key: string
  blob: Blob
}

/** Lightweight metadata for a cached blob — scanned for LRU eviction without
 *  loading the blob bytes (kept in a separate store so scans stay cheap). */
export interface AttMetaRow {
  key: string
  owner: string
  bytes: number
  lastAccessedAt: number
}

/**
 * A voice recording that hasn't yet been transcribed-and-inserted. Persisted as
 * a COMPLETE accumulated blob (not per-chunk) so a recovered file is always
 * valid across containers — iOS mp4 in particular doesn't reassemble from
 * arbitrary chunk boundaries. Checkpointed during recording and on stop; deleted
 * once its text is safely in an entry. The safety net for "never lose a long
 * dictation" — survives a transcription failure, a closed tab, or a crash.
 */
export interface PendingDictationRow {
  sessionId: string
  owner: string
  mime: string
  createdAt: number
  updatedAt: number
  status: 'recording' | 'recorded'
  blob: Blob
}

interface DayspringDB extends DBSchema {
  entries: { key: string; value: Entry }
  outbox: { key: string; value: OutboxOp; indexes: { 'by-entry': string } }
  attBlobs: { key: string; value: AttBlobRow }
  attMeta: { key: string; value: AttMetaRow; indexes: { 'by-last-accessed': number } }
  dictation: { key: string; value: PendingDictationRow }
}

let dbp: Promise<IDBPDatabase<DayspringDB>> | null = null

function db(): Promise<IDBPDatabase<DayspringDB>> {
  if (!dbp) {
    dbp = openDB<DayspringDB>('dayspring', 3, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('entries', { keyPath: 'id' })
          const outbox = d.createObjectStore('outbox', { keyPath: 'opId' })
          outbox.createIndex('by-entry', 'entryId')
        }
        if (oldVersion < 2) {
          // Bounded LRU cache of display-sized image blobs (perf + offline).
          // The cloud is the source of truth, so eviction here is lossless.
          d.createObjectStore('attBlobs', { keyPath: 'key' })
          const meta = d.createObjectStore('attMeta', { keyPath: 'key' })
          meta.createIndex('by-last-accessed', 'lastAccessedAt')
        }
        if (oldVersion < 3) {
          d.createObjectStore('dictation', { keyPath: 'sessionId' })
        }
      },
    })
  }
  return dbp
}

// ── pending voice recordings (crash-safe dictation) ──────────────────────────
export async function dictationCheckpoint(row: PendingDictationRow): Promise<void> {
  await (await db()).put('dictation', row)
}
export async function dictationList(owner: string): Promise<PendingDictationRow[]> {
  const all = await (await db()).getAll('dictation')
  return all.filter((r) => r.owner === owner).sort((a, b) => b.createdAt - a.createdAt)
}
export async function dictationDelete(sessionId: string): Promise<void> {
  await (await db()).delete('dictation', sessionId)
}
/** Drop recordings older than `ms` — abandoned sessions a user never recovered. */
export async function dictationPrune(ms: number): Promise<void> {
  const d = await db()
  const cutoff = Date.now() - ms
  const all = await d.getAll('dictation')
  await Promise.all(all.filter((r) => r.updatedAt < cutoff).map((r) => d.delete('dictation', r.sessionId)))
}

// ── entries cache ──────────────────────────────────────────────────────────
export async function cacheGetAll(): Promise<Entry[]> {
  return (await db()).getAll('entries')
}
export async function cacheGet(id: string): Promise<Entry | undefined> {
  return (await db()).get('entries', id)
}
export async function cachePut(entry: Entry): Promise<void> {
  await (await db()).put('entries', entry)
}
export async function cachePutMany(entries: Entry[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('entries', 'readwrite')
  await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done])
}
export async function cacheDelete(id: string): Promise<void> {
  await (await db()).delete('entries', id)
}
export async function cacheClear(): Promise<void> {
  await (await db()).clear('entries')
}
/** Wipe ALL local journal state — entries cache + pending outbox. Used on
 *  sign-out and on an owner switch so one account's data never bleeds into
 *  another's on a shared browser. */
export async function cacheClearAll(): Promise<void> {
  const d = await db()
  await Promise.all([
    d.clear('entries'),
    d.clear('outbox'),
    d.clear('attBlobs'),
    d.clear('attMeta'),
    d.clear('dictation'),
  ])
}

// ── image blob cache (bounded LRU) ───────────────────────────────────────────
// Update lastAccessedAt at most this often, so reads don't thrash the store.
const LRU_TOUCH_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Choose which cached entries to evict so that `incomingBytes` fits under
 * `budgetBytes`. Pure (no idb) for testability: evicts least-recently-used
 * first. Returns the keys to drop.
 */
export function selectEvictions(
  metas: Array<{ key: string; bytes: number; lastAccessedAt: number }>,
  budgetBytes: number,
  incomingBytes: number,
): string[] {
  const total = metas.reduce((sum, m) => sum + m.bytes, 0)
  let over = total + incomingBytes - budgetBytes
  if (over <= 0) return []
  const evict: string[] = []
  for (const m of [...metas].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)) {
    if (over <= 0) break
    evict.push(m.key)
    over -= m.bytes
  }
  return evict
}

export async function attachmentCacheGet(key: string): Promise<Blob | undefined> {
  const d = await db()
  const row = await d.get('attBlobs', key)
  if (!row) return undefined
  // Throttled LRU touch — only write when the timestamp is meaningfully stale.
  const meta = await d.get('attMeta', key)
  if (meta && Date.now() - meta.lastAccessedAt > LRU_TOUCH_INTERVAL_MS) {
    void d.put('attMeta', { ...meta, lastAccessedAt: Date.now() })
  }
  return row.blob
}

export async function attachmentCachePut(
  key: string,
  owner: string,
  blob: Blob,
  budgetBytes: number,
): Promise<void> {
  const d = await db()
  const metas = await d.getAll('attMeta')
  const evict = selectEvictions(
    metas.filter((m) => m.key !== key),
    budgetBytes,
    blob.size,
  )
  const tx = d.transaction(['attBlobs', 'attMeta'], 'readwrite')
  await Promise.all([
    ...evict.flatMap((k) => [tx.objectStore('attBlobs').delete(k), tx.objectStore('attMeta').delete(k)]),
    tx.objectStore('attBlobs').put({ key, blob }),
    tx.objectStore('attMeta').put({ key, owner, bytes: blob.size, lastAccessedAt: Date.now() }),
    tx.done,
  ])
}

export async function attachmentCacheTotalBytes(): Promise<number> {
  const metas = await (await db()).getAll('attMeta')
  return metas.reduce((sum, m) => sum + m.bytes, 0)
}

// ── outbox (pending writes) ─────────────────────────────────────────────────
export async function outboxAll(): Promise<OutboxOp[]> {
  return (await db()).getAll('outbox')
}
export async function outboxCount(): Promise<number> {
  return (await db()).count('outbox')
}
export async function outboxAdd(op: OutboxOp): Promise<void> {
  await (await db()).put('outbox', op)
}
export async function outboxRemove(opId: string): Promise<void> {
  await (await db()).delete('outbox', opId)
}
/** Collapse duplicate ops for one entry: drop existing ops of the same kind. */
export async function outboxRemoveForEntry(entryId: string, kind: OutboxOp['kind']): Promise<void> {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  const ops = await tx.store.index('by-entry').getAll(entryId)
  await Promise.all([...ops.filter((o) => o.kind === kind).map((o) => tx.store.delete(o.opId)), tx.done])
}
