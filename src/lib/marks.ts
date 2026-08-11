// Marks — a passage the writer set apart while re-reading.
//
// Offline-first like everything else: the local mirror in IndexedDB is what the
// UI reads, a `pending` flag carries the intent, and `drainPendingMarks` pushes
// it when the network returns. Marks ride repo's sideQueueHook rather than the
// entry outbox — that queue is keyed on entryId and reads its payload from the
// entries cache, and a stuck mark must never be able to block an entry from
// syncing.
//
// Idempotent end to end: the server has a unique index on (entry_id, md5(quote))
// and the local id is derived from the same pair, so marking the same sentence
// twice from two devices converges on one row.

import { supabase } from './supabase'
import * as cache from './db'
import type { MarkRow } from './db'

export interface Mark {
  id: string
  entryId: string
  quote: string
  charStart: number | null
  noticedAt: string
}

/** Whitespace-collapsed. A mark is matched by its words, never by its layout. */
export function normalizeQuote(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Stable id for (entry, quote), so the same sentence marked on two devices is
 * one row rather than a race. UUIDv5-shaped but computed locally — we only need
 * determinism, not cryptographic identity.
 */
export function markId(entryId: string, quote: string): string {
  const s = `${entryId}::${normalizeQuote(quote).toLowerCase()}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) >>> 0
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0')
  const a = hex(h1)
  const b = hex(h2)
  const c = hex((h1 ^ h2) >>> 0)
  const d = hex((h1 + h2) >>> 0)
  return `${a}-${b.slice(0, 4)}-5${b.slice(5)}-8${c.slice(1, 4)}-${c.slice(4)}${d}`
}

const toMark = (r: MarkRow): Mark => ({
  id: r.id,
  entryId: r.entryId,
  quote: r.quote,
  charStart: r.charStart,
  noticedAt: r.noticedAt,
})

/** Every mark, newest first. Reads the local mirror — no network, works offline. */
export async function listMarks(): Promise<Mark[]> {
  const rows = (await cache.marksAll()).filter((r) => r.pending !== 'remove')
  return rows
    .sort((a, b) => Date.parse(b.noticedAt) - Date.parse(a.noticedAt))
    .map(toMark)
}

/** Marks on one entry, for the editor decoration. */
export async function marksForEntry(entryId: string): Promise<Mark[]> {
  return (await listMarks()).filter((m) => m.entryId === entryId)
}

/** Mark a passage. Local and instant; the server hears about it on the next drain. */
export async function addMark(
  entryId: string,
  rawQuote: string,
  charStart: number | null = null,
): Promise<Mark | null> {
  const quote = normalizeQuote(rawQuote)
  if (!quote) return null
  const row: MarkRow = {
    id: markId(entryId, quote),
    entryId,
    quote,
    charStart,
    noticedAt: new Date().toISOString(),
    pending: 'add',
  }
  await cache.markPut(row)
  void drainPendingMarks().catch(() => {})
  return toMark(row)
}

/** Unmark. Tombstoned locally until the delete reaches the server. */
export async function removeMark(id: string): Promise<void> {
  const existing = (await cache.marksAll()).find((r) => r.id === id)
  if (!existing) return
  if (existing.pending === 'add') {
    // Never reached the server — nothing to tell it about.
    await cache.markDelete(id)
    return
  }
  await cache.markPut({ ...existing, pending: 'remove' })
  void drainPendingMarks().catch(() => {})
}

/** Pull the server's marks into the local mirror. Called on sync. */
export async function pullMarks(): Promise<void> {
  const sb = supabase
  if (!sb) return
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return

  const { data, error } = await sb
    .from('marks')
    .select('id, entry_id, quote, char_start, noticed_at')
    .eq('owner', session.user.id)
    .order('noticed_at', { ascending: false })
  if (error) throw error

  await cache.marksReplaceSynced(
    (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      entryId: String(r.entry_id),
      quote: String(r.quote),
      charStart: r.char_start == null ? null : Number(r.char_start),
      noticedAt: String(r.noticed_at),
    })),
  )
}

/**
 * Push everything queued. Safe to call often — a no-op when nothing is pending.
 *
 * Failures leave the row pending and return quietly. The caller is repo's
 * sideQueueHook, which already swallows side-queue errors so they can't fail
 * the entry flush.
 */
export async function drainPendingMarks(): Promise<void> {
  const pending = (await cache.marksAll()).filter((r) => r.pending)
  if (pending.length === 0) return

  const sb = supabase
  if (!sb) return
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return
  const owner = session.user.id

  const adds = pending.filter((r) => r.pending === 'add')
  const removes = pending.filter((r) => r.pending === 'remove')

  if (adds.length > 0) {
    const { error } = await sb.from('marks').upsert(
      adds.map((r) => ({
        id: r.id,
        owner,
        entry_id: r.entryId,
        quote: r.quote,
        char_start: r.charStart,
        noticed_at: r.noticedAt,
      })),
      { onConflict: 'id' },
    )
    if (!error) {
      await cache.marksPutMany(adds.map(({ pending: _p, ...rest }) => rest))
    }
  }

  if (removes.length > 0) {
    const { error } = await sb
      .from('marks')
      .delete()
      .eq('owner', owner)
      .in('id', removes.map((r) => r.id))
    if (!error) {
      for (const r of removes) await cache.markDelete(r.id)
    }
  }
}

/**
 * Where does this quote sit in the current text?
 *
 * `charStart` is only a hint — an edit anywhere above a passage moves it. So we
 * check the hint first (the common case, and O(1)), then fall back to searching
 * for the text. A null return means the sentence is gone: the mark is orphaned,
 * which is a display state, not an error. It still belongs in Remember, because
 * it is still verbatim what the writer wrote.
 *
 * Known and accepted: formatting a marked sentence orphans its mark, because
 * the quote is matched against the RAW markdown and bolding or highlighting
 * inserts markers into it. Any edit already does this — and marking is a
 * reading act, so it is rare to then reformat the same words — but if that ever
 * feels like data loss, the fix is to match against stripInlineMarkers(body)
 * and map the index back through the strip. Not free; not obviously worth it.
 */
export function anchorOf(body: string, mark: Pick<Mark, 'quote' | 'charStart'>): number | null {
  const { quote, charStart } = mark
  if (!quote) return null
  if (charStart != null && body.startsWith(quote, charStart)) return charStart

  const exact = body.indexOf(quote)
  if (exact !== -1) return exact

  // The stored quote is whitespace-collapsed; the document may have wrapped it
  // across lines since. Match on words instead of on layout.
  const pattern = quote
    .split(' ')
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  const m = new RegExp(pattern).exec(body)
  return m ? m.index : null
}
