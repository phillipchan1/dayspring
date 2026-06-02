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

function subscribeEntryChangesImmediate(onChange: (event: EntryChangeEvent) => void): () => void {
  const sb = supabase
  if (!sb) return () => {}

  const channel = sb
    .channel('entries-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries' },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        if (payload.eventType === 'DELETE') {
          const entryId = payload.old?.id as string | undefined
          if (!entryId) return
          onChange({ eventType: 'DELETE', entryId })
          return
        }
        const row = payload.new
        if (!row?.id) return
        onChange({ eventType: payload.eventType, entry: toEntry(row) })
      },
    )
    .subscribe()

  return () => {
    void sb.removeChannel(channel)
  }
}

/** Live entry feed for the signed-in user (RLS-scoped). Coalesces rapid bursts (bulk delete, import). */
export function subscribeEntryChanges(onBatch: (events: EntryChangeEvent[]) => void): () => void {
  let queue: EntryChangeEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    timer = null
    if (!queue.length) return
    const batch = queue
    queue = []
    onBatch(batch)
  }

  const schedule = () => {
    if (timer) return
    timer = setTimeout(flush, BATCH_MS)
  }

  const unsub = subscribeEntryChangesImmediate((event) => {
    queue.push(event)
    schedule()
  })

  return () => {
    if (timer) clearTimeout(timer)
    queue = []
    unsub()
  }
}
