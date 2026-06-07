import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Entry } from './types'

export interface OutboxOp {
  opId: string
  kind: 'upsert' | 'delete'
  entryId: string
  ts: number
}

interface DayspringDB extends DBSchema {
  entries: { key: string; value: Entry }
  outbox: { key: string; value: OutboxOp; indexes: { 'by-entry': string } }
}

let dbp: Promise<IDBPDatabase<DayspringDB>> | null = null

function db(): Promise<IDBPDatabase<DayspringDB>> {
  if (!dbp) {
    dbp = openDB<DayspringDB>('dayspring', 1, {
      upgrade(d) {
        d.createObjectStore('entries', { keyPath: 'id' })
        const outbox = d.createObjectStore('outbox', { keyPath: 'opId' })
        outbox.createIndex('by-entry', 'entryId')
      },
    })
  }
  return dbp
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
  await Promise.all([d.clear('entries'), d.clear('outbox')])
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
