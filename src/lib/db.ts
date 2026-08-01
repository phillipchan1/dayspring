import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Entry } from './types'

export interface OutboxOp {
  opId: string
  /**
   * `derive` rebuilds the rows read off an entry's body — prayers, scripture
   * refs. It is queued after that entry's push succeeds rather than run inline
   * on save, so writing a prayer offline still reaches the Altar once the device
   * reconnects. See repo.setEntryDeriveHook.
   */
  kind: 'upsert' | 'delete' | 'derive'
  entryId: string
  ts: number
  /** Pushes that reached the server and were refused. Absent until the first failure. */
  attempts?: number
  /** Last refusal, kept for support triage — never shown verbatim in the UI. */
  lastError?: string
  /**
   * Given up on: the server will never accept this op, or it has burned through
   * MAX_SYNC_ATTEMPTS. Skipped by the flush so it can't block the ops behind it.
   */
  quarantined?: boolean
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

/**
 * A photo the user added that hasn't reached storage yet. Keyed by the same
 * `pendingId` that appears in the entry body as `attachment-pending:<id>`, so a
 * successful retry can find its placeholder and swap in the real ref.
 *
 * Unlike attBlobs (a lossless LRU cache of things the cloud already has), this
 * holds the ONLY copy of those bytes. It is never evicted.
 */
export interface PendingUploadRow {
  id: string
  owner: string
  blob: Blob
  ext: string
  alt: string
  meta?: Record<string, unknown>
  createdAt: number
  attempts?: number
  lastError?: string
  quarantined?: boolean
}

interface DayspringDB extends DBSchema {
  entries: { key: string; value: Entry }
  outbox: { key: string; value: OutboxOp; indexes: { 'by-entry': string } }
  attBlobs: { key: string; value: AttBlobRow }
  attMeta: { key: string; value: AttMetaRow; indexes: { 'by-last-accessed': number } }
  dictation: { key: string; value: PendingDictationRow }
  attUploads: { key: string; value: PendingUploadRow }
}

let dbp: Promise<IDBPDatabase<DayspringDB>> | null = null

function db(): Promise<IDBPDatabase<DayspringDB>> {
  if (!dbp) {
    dbp = openDB<DayspringDB>('dayspring', 4, {
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
        if (oldVersion < 4) {
          // Photos added while offline. Holds the only copy of those bytes —
          // unlike attBlobs, nothing here may be evicted.
          d.createObjectStore('attUploads', { keyPath: 'id' })
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
    d.clear('attUploads'),
  ])
}

// ── pending photo uploads (offline-durable) ─────────────────────────────────
export async function pendingUploadPut(row: PendingUploadRow): Promise<void> {
  await (await db()).put('attUploads', row)
}
export async function pendingUploadAll(): Promise<PendingUploadRow[]> {
  return (await (await db()).getAll('attUploads')).sort((a, b) => a.createdAt - b.createdAt)
}
export async function pendingUploadDelete(id: string): Promise<void> {
  await (await db()).delete('attUploads', id)
}
/** Photos still waiting to reach storage — excludes ones we've given up on. */
export async function pendingUploadCount(): Promise<number> {
  return (await pendingUploadAll()).filter((r) => !r.quarantined).length
}
export async function pendingUploadMarkFailure(
  id: string,
  { quarantine, error }: { quarantine: boolean; error: string },
): Promise<void> {
  const d = await db()
  const tx = d.transaction('attUploads', 'readwrite')
  const row = await tx.store.get(id)
  if (row) {
    await tx.store.put({
      ...row,
      attempts: (row.attempts ?? 0) + 1,
      lastError: error,
      quarantined: quarantine,
    })
  }
  await tx.done
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
/**
 * Ops in the order they were queued. `getAll` returns them keyed by `opId` — a
 * random UUID — so the unordered version flushes writes in arbitrary order and
 * which op blocks the queue is pure chance. Anything that drains the outbox
 * should use this.
 */
export async function outboxAllOrdered(): Promise<OutboxOp[]> {
  return (await outboxAll()).sort((a, b) => a.ts - b.ts)
}
export async function outboxCount(): Promise<number> {
  return (await db()).count('outbox')
}
/** True when at least one live (non-quarantined) op of `kind` is queued. */
export async function outboxHasKind(kind: OutboxOp['kind']): Promise<boolean> {
  return (await outboxAll()).some((o) => o.kind === kind && !o.quarantined)
}
/** Ops the flush has given up on — surfaced so the UI can stop claiming "Synced". */
export async function outboxBlockedCount(): Promise<number> {
  return (await outboxAll()).filter((o) => o.quarantined).length
}
export async function outboxAdd(op: OutboxOp): Promise<void> {
  await (await db()).put('outbox', op)
}
export async function outboxRemove(opId: string): Promise<void> {
  await (await db()).delete('outbox', opId)
}
/**
 * Record a refused push. `quarantine` retires the op so it stops being retried
 * and — crucially — stops blocking every op queued behind it. The row is kept
 * rather than deleted: it still holds a write the user made, and keeping it lets
 * a later fix (a corrected RLS policy, a released constraint) replay it.
 */
export async function outboxMarkFailure(
  opId: string,
  { quarantine, error }: { quarantine: boolean; error: string },
): Promise<void> {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  const op = await tx.store.get(opId)
  if (op) {
    const attempts = (op.attempts ?? 0) + 1
    await tx.store.put({ ...op, attempts, lastError: error, quarantined: quarantine })
  }
  await tx.done
}
/** Un-retire every quarantined op so the next flush tries them again. */
export async function outboxClearQuarantine(): Promise<void> {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  const ops = await tx.store.getAll()
  await Promise.all([
    ...ops
      .filter((o) => o.quarantined)
      .map((o) => tx.store.put({ ...o, quarantined: false, attempts: 0 })),
    tx.done,
  ])
}

/** Collapse duplicate ops for one entry: drop existing ops of the same kind. */
export async function outboxRemoveForEntry(entryId: string, kind: OutboxOp['kind']): Promise<void> {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  const ops = await tx.store.index('by-entry').getAll(entryId)
  await Promise.all([...ops.filter((o) => o.kind === kind).map((o) => tx.store.delete(o.opId)), tx.done])
}
