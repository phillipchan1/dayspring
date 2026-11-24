import { apiGet } from './api'
import { isPresent } from './presence'
import { isCircumstances } from './circumstances'
import type { Entry } from './types'

function toEntry(row: Record<string, unknown>): Entry {
  const circumstances = isCircumstances(row.circumstances) ? row.circumstances : null
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    body_markdown: (row.body_markdown as string | null | undefined) ?? '',
    title: (row.title as string | null) ?? null,
    mood: (row.mood as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    word_count: row.word_count as number,
    source: row.source as Entry['source'],
    external_id: (row.external_id as string | null) ?? null,
    ...(circumstances ? { circumstances } : {}),
  }
}

export type EntryChangeEvent =
  | { eventType: 'INSERT' | 'UPDATE'; entry: Entry }
  | { eventType: 'DELETE'; entryId: string }

const BATCH_MS = 80

/**
 * Slow poll while someone is using the app (visible and touched within
 * presence.IDLE_AFTER_MS). Focus/visibility already refetch, and the journal's
 * heartbeat catches up on the first input after an idle stretch.
 */
export const ENTRY_POLL_IDLE_MS = 45_000

interface SubscribeOptions {
  /** Called with each coalesced batch of change events. */
  onBatch: (events: EntryChangeEvent[]) => void
  /**
   * Called when events may have been missed (app returns to the foreground)
   * so the caller can trigger a full reconcile — needed for deletes, which
   * a changed-since query cannot see.
   */
  onReconnect?: () => void
}

function isoCursor(entries: Entry[], fallback: string | null): string | null {
  let latest = fallback
  for (const entry of entries) {
    if (!latest || entry.updated_at > latest) latest = entry.updated_at
  }
  return latest
}

/**
 * Live entry feed for the signed-in user. Polls the Worker for rows changed
 * since the last pull: refetch on focus/visibility, plus a slow interval
 * while someone is present (never while idle — that would keep the database
 * awake for a window nobody is looking at). Deletes are caught by `onReconnect` on
 * return-to-foreground (changed-since cannot see removed rows).
 */
export function subscribeEntryChanges({ onBatch, onReconnect }: SubscribeOptions): () => void {
  let cursor: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let interval: ReturnType<typeof setInterval> | null = null
  let queue: EntryChangeEvent[] = []
  let alive = true
  let inflight: Promise<void> | null = null
  let hiddenAt: number | null = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? Date.now()
    : null

  const flushQueue = () => {
    timer = null
    if (!queue.length) return
    const batch = queue
    queue = []
    onBatch(batch)
  }

  const schedule = () => {
    if (timer) return
    timer = setTimeout(flushQueue, BATCH_MS)
  }

  const emit = (entries: Entry[]) => {
    for (const entry of entries) {
      queue.push({ eventType: 'UPDATE', entry })
    }
    if (entries.length) schedule()
  }

  const pollChanged = async () => {
    if (!alive) return
    try {
      if (!cursor) {
        const data = await apiGet<{ entries: Entry[] }>('/api/data/entries')
        cursor = isoCursor(data.entries ?? [], null)
        return
      }
      const data = await apiGet<{ entries: Entry[] }>(
        `/api/data/entries?since=${encodeURIComponent(cursor)}`,
      )
      const rows = (data.entries ?? []).map((row) => toEntry(row as unknown as Record<string, unknown>))
      emit(rows)
      cursor = isoCursor(rows, cursor)
    } catch {
      /* offline — keep the cursor; the next focus/interval retries */
    }
  }

  const run = (fn: () => Promise<void>) => {
    inflight = (inflight ?? Promise.resolve()).then(fn).finally(() => {
      inflight = null
    })
    return inflight
  }

  const onFocus = () => {
    if (!alive) return
    if (hiddenAt != null) {
      hiddenAt = null
      onReconnect?.()
    }
    void run(pollChanged)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    onFocus()
  }

  const startInterval = () => {
    if (interval) return
    interval = setInterval(() => {
      if (!isPresent()) return
      void run(pollChanged)
    }, ENTRY_POLL_IDLE_MS)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
  }
  startInterval()
  void run(pollChanged)
  onReconnect?.()

  return () => {
    alive = false
    if (timer) clearTimeout(timer)
    if (interval) clearInterval(interval)
    queue = []
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }
}
