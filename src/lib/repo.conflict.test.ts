// The bug this file exists for: an entry written on a desktop turned up on a
// phone as two rows, one a partial copy of the other. Nobody edited it twice.
//
// The daily cron stamps prayer_scanned_at on entries the model hasn't read —
// which is exactly an entry being written this morning — and the updated_at
// trigger treated that as a user edit. updated_at is the base an optimistic push
// declares, so moving it under a device being typed on made the very next push
// look like a collision with another device, and a collision is resolved by
// keeping both versions. The "other version" was this device's own text from
// 1.5 seconds ago.
//
// These tests drive the real repo against an in-memory Supabase whose
// upsert_entry_checked and updated_at trigger behave like the migrations, so the
// scenario can be replayed end to end.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from './types'

const h = vi.hoisted(() => {
  const state = {
    clock: 0,
    /** Arm a dropped response on the write that follows the next conflict. */
    failAfterNextConflict: false,
    failNextWrite: false,
  }
  return {
    cached: new Map<string, Entry>(),
    outbox: new Map<string, Record<string, unknown>>(),
    server: new Map<string, Entry>(),
    state,
    tick(): string {
      state.clock += 1
      return `2026-08-23T09:${String(Math.floor(state.clock / 60)).padStart(2, '0')}:${String(
        state.clock % 60,
      ).padStart(2, '0')}.000Z`
    },
  }
})

vi.mock('./db', () => ({
  cacheGet: async (id: string) => h.cached.get(id),
  cacheGetAll: async () => [...h.cached.values()],
  cachePut: async (e: Entry) => void h.cached.set(e.id, e),
  cachePutMany: async (list: Entry[]) => void list.forEach((e) => h.cached.set(e.id, e)),
  cacheDelete: async (id: string) => void h.cached.delete(id),
  outboxAdd: async (op: { opId: string }) => void h.outbox.set(op.opId, op),
  outboxAll: async () => [...h.outbox.values()],
  outboxAllOrdered: async () =>
    [...h.outbox.values()].sort((a, b) => (a.ts as number) - (b.ts as number)),
  outboxRemove: async (opId: string) => void h.outbox.delete(opId),
  outboxRemoveForEntry: async (entryId: string, kind: string) => {
    for (const [key, op] of h.outbox) {
      if (op.entryId === entryId && op.kind === kind) h.outbox.delete(key)
    }
  },
  outboxMarkFailure: async (opId: string, opts: { quarantine: boolean; error: string }) => {
    const op = h.outbox.get(opId)
    if (!op) return
    op.attempts = ((op.attempts as number) ?? 0) + 1
    op.quarantined = opts.quarantine
    op.lastError = opts.error
  },
  outboxClearQuarantine: async () => {
    for (const op of h.outbox.values()) op.quarantined = false
  },
  outboxHasKind: async (kind: string) => [...h.outbox.values()].some((o) => o.kind === kind),
}))

vi.mock('./entries', () => {
  // Columns the client can see. Mirrors ENTRY_COLUMNS, and the allowlist the
  // updated_at trigger uses after 20260823120000.
  const VISIBLE = [
    'created_at',
    'body_markdown',
    'title',
    'mood',
    'tags',
    'word_count',
    'source',
    'external_id',
  ] as const

  /** The server never sees the client's local-only bookkeeping. */
  const asServerRow = (entry: Entry): Entry => {
    const row = { ...entry }
    delete row.local_edited_at
    delete row.base_body_markdown
    return row
  }

  return {
    wordCount: (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0),
    byCreatedDesc: (a: { created_at: string }, b: { created_at: string }) =>
      a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0,
    deleteEntry: async (id: string) => void h.server.delete(id),
    listAllEntries: async () => [...h.server.values()].map((r) => ({ ...r })),
    listEntriesSince: async (cursor: string) =>
      [...h.server.values()].filter((r) => r.updated_at > cursor).map((r) => ({ ...r })),
    upsertEntryChecked: async (entry: Entry, base: string | null) => {
      if (h.state.failNextWrite) {
        h.state.failNextWrite = false
        throw new TypeError('Failed to fetch')
      }
      const existing = h.server.get(entry.id)
      if (!existing) {
        const row = { ...asServerRow(entry), updated_at: h.tick() }
        h.server.set(row.id, row)
        return { conflicted: false, entry: { ...row } }
      }
      if (existing.updated_at !== base) {
        if (h.state.failAfterNextConflict) {
          h.state.failAfterNextConflict = false
          h.state.failNextWrite = true
        }
        return { conflicted: true, entry: { ...existing } }
      }
      const next = { ...asServerRow(entry), updated_at: existing.updated_at }
      const changed = VISIBLE.some(
        (k) => JSON.stringify(next[k]) !== JSON.stringify(existing[k]),
      )
      if (changed) next.updated_at = h.tick()
      h.server.set(next.id, next)
      return { conflicted: false, entry: { ...next } }
    },
  }
})

const repo = await import('./repo')

const PUSHED = 'Lord, I am weary todya. The week has been long.'
const FIXED = 'Lord, I am weary today. The week has been long. Meet me here.'

/** What the cron did: a watermark column written, body untouched, clock moved. */
function stampWatermark(id: string): void {
  h.server.get(id)!.updated_at = h.tick()
}

/** What a second device does: real writing, and the clock moves with it. */
function otherDeviceWrites(id: string, body: string): void {
  const row = h.server.get(id)!
  row.body_markdown = body
  row.updated_at = h.tick()
}

const serverBodies = (): string[] => [...h.server.values()].map((r) => r.body_markdown).sort()

beforeEach(() => {
  vi.useFakeTimers() // keep scheduleFlush's background timer from firing mid-test
  vi.stubGlobal('navigator', { onLine: true })
  h.cached.clear()
  h.outbox.clear()
  h.server.clear()
  h.state.clock = 0
  h.state.failAfterNextConflict = false
  h.state.failNextWrite = false
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Drain until nothing is left queued — pushes queue follow-up work of their own. */
async function drain(): Promise<void> {
  for (let i = 0; i < 5 && h.outbox.size > 0; i++) await repo.flush()
}

describe('a conflict nobody caused', () => {
  it('REGRESSION: a watermark bump plus a typo fix leaves one entry, not two', async () => {
    await repo.createEntry({ body_markdown: PUSHED }, 'entry-1')
    await drain()
    expect(serverBodies()).toEqual([PUSHED])

    stampWatermark('entry-1')

    // Still the same writing session: the typo goes, a sentence arrives. The old
    // body is no longer a substring of the new one, which is all it used to take.
    await repo.updateEntryBody('entry-1', FIXED)
    await drain()

    expect(serverBodies()).toEqual([FIXED])
    expect(h.cached.size).toBe(1)
  })

  it('leaves nothing queued and nothing stale behind it', async () => {
    await repo.createEntry({ body_markdown: PUSHED }, 'entry-1')
    await drain()
    stampWatermark('entry-1')
    await repo.updateEntryBody('entry-1', FIXED)
    await drain()

    // The base caught up, so the next edit doesn't conflict all over again.
    const cached = h.cached.get('entry-1')!
    expect(cached.updated_at).toBe(h.server.get('entry-1')!.updated_at)
    expect(cached.base_body_markdown).toBe(FIXED)
    expect(h.outbox.size).toBe(0)
  })

  it('survives the watermark landing over and over', async () => {
    await repo.createEntry({ body_markdown: PUSHED }, 'entry-1')
    await drain()
    for (const body of ['one more line.', 'and another.', 'and one more.']) {
      stampWatermark('entry-1')
      await repo.updateEntryBody('entry-1', `${FIXED} ${body}`)
      await drain()
    }
    expect(h.server.size).toBe(1)
    expect(h.cached.size).toBe(1)
  })
})

describe('a conflict someone did cause', () => {
  const SHARED = 'Lord, I am weary today. The week has been long.'

  it('still keeps the other device\u2019s writing rather than overwriting it', async () => {
    await repo.createEntry({ body_markdown: SHARED }, 'entry-1')
    await drain()

    otherDeviceWrites('entry-1', `${SHARED} Their ending.`)
    await repo.updateEntryBody('entry-1', `${SHARED} Our ending.`)
    await drain()

    expect(serverBodies()).toEqual([`${SHARED} Our ending.`, `${SHARED} Their ending.`])
  })

  it('preserves the other version ONCE however often the push is retried', async () => {
    await repo.createEntry({ body_markdown: SHARED }, 'entry-1')
    await drain()

    otherDeviceWrites('entry-1', `${SHARED} Their ending.`)
    await repo.updateEntryBody('entry-1', `${SHARED} Our ending.`)

    // The push conflicts, sets their version aside, rebases — and the network
    // drops before the rebased write lands, so the op stays queued and the whole
    // conflict is met again on the next flush. A random id per call made that a
    // second copy; naming the row after the version it holds does not.
    h.state.failAfterNextConflict = true
    await drain()

    expect(h.server.size).toBe(2)
    expect(h.cached.size).toBe(2)
    expect(serverBodies()).toEqual([`${SHARED} Our ending.`, `${SHARED} Their ending.`])
  })

  it('puts the preserved version on the same day as the entry it came from', async () => {
    await repo.createEntry({ body_markdown: SHARED }, 'entry-1')
    await drain()
    const day = h.server.get('entry-1')!.created_at

    otherDeviceWrites('entry-1', `${SHARED} Their ending.`)
    await repo.updateEntryBody('entry-1', `${SHARED} Our ending.`)
    await drain()

    const preserved = [...h.server.values()].find((r) => r.id !== 'entry-1')!
    expect(preserved.created_at).toBe(day)
    expect(preserved.source).toBe('native')
    expect(preserved.external_id).toBeNull()
  })
})

describe('the stale base cannot strand', () => {
  it('takes a moved timestamp from realtime while keeping the body being typed', async () => {
    await repo.createEntry({ body_markdown: PUSHED }, 'entry-1')
    await drain()

    // Mid-sentence, with the edit still queued — the state in which the pull used
    // to be refused outright, leaving the base behind forever.
    await repo.updateEntryBody('entry-1', FIXED)
    stampWatermark('entry-1')
    const moved = h.server.get('entry-1')!.updated_at

    const verdict = await repo.mergeRemoteEntry({ ...h.server.get('entry-1')! })
    expect(verdict).toBe('rebased')
    expect(h.cached.get('entry-1')).toMatchObject({
      body_markdown: FIXED,
      updated_at: moved,
      base_body_markdown: PUSHED,
    })

    // And so the push that follows lands first time.
    await drain()
    expect(serverBodies()).toEqual([FIXED])
  })

  it('heals the base on a full reconcile too', async () => {
    await repo.createEntry({ body_markdown: PUSHED }, 'entry-1')
    await drain()
    await repo.updateEntryBody('entry-1', FIXED)
    stampWatermark('entry-1')

    await repo.sync('entry-1')
    expect(h.cached.get('entry-1')!.body_markdown).toBe(FIXED)
    expect(serverBodies()).toEqual([FIXED])
    expect(h.server.size).toBe(1)
  })
})
