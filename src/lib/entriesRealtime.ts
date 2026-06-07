import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Entry } from './types'

function toEntry(row: Record<string, unknown>): Entry {
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
  }
}

export type EntryChangeEvent =
  | { eventType: 'INSERT' | 'UPDATE'; entry: Entry }
  | { eventType: 'DELETE'; entryId: string }

const BATCH_MS = 80

interface SubscribeOptions {
  /** Called with each coalesced batch of change events. */
  onBatch: (events: EntryChangeEvent[]) => void
  /**
   * Called when the realtime channel reconnects after having been
   * disconnected — signals that events may have been missed and a full
   * reconcile is needed.
   */
  onReconnect?: () => void
}

/**
 * Live entry feed for the signed-in user (RLS-scoped). Coalesces rapid
 * bursts (bulk delete, import). Calls `onReconnect` when the WebSocket
 * channel re-establishes after a drop so the caller can trigger a full sync.
 */
export function subscribeEntryChanges({ onBatch, onReconnect }: SubscribeOptions): () => void {
  const sb = supabase
  if (!sb) return () => {}

  let queue: EntryChangeEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  // Track whether we've ever been SUBSCRIBED so we can detect reconnects
  // (status goes SUBSCRIBED → CLOSED/TIMED_OUT → SUBSCRIBED again).
  let everSubscribed = false

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

  const channel = sb
    .channel(`entries-live:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries' },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        if (payload.eventType === 'DELETE') {
          const entryId = payload.old?.id as string | undefined
          if (!entryId) return
          queue.push({ eventType: 'DELETE', entryId })
        } else {
          const row = payload.new
          if (!row?.id) return
          queue.push({ eventType: payload.eventType, entry: toEntry(row) })
        }
        schedule()
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (everSubscribed) {
          // Channel re-established after a drop — events were missed during
          // the outage. Flush the queue (stale) and request a full reconcile.
          if (timer) { clearTimeout(timer); timer = null }
          queue = []
          onReconnect?.()
        }
        everSubscribed = true
      }
    })

  return () => {
    if (timer) clearTimeout(timer)
    queue = []
    void sb.removeChannel(channel)
  }
}
