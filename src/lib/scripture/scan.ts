// User-facing "scan your journal for references" — the in-app equivalent of the
// CLI backfill. Imported entries never pass through the editor, so live capture
// (reconcile-on-save) never sees them; this lets the user light them on the map.
//
// Runs CLIENT-SIDE on purpose: the parser is isomorphic and the browser has no
// serverless timeout, so it can page through thousands of entries with progress.
// Pure regex — NO model calls, no token cost. Writes through the authenticated
// session (owner defaults to auth.uid()); idempotent via the (entry_id, osis_ref)
// unique index, so re-running only adds what's missing.

import { requireSupabase } from '../supabase'
import { parseReferences } from './parse'

/** Count of imported (non-native) entries — the entries live capture never sees. */
export async function getImportedEntryCount(): Promise<number> {
  const sb = requireSupabase()
  const { count, error } = await sb
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .neq('source', 'native')
  if (error) throw error
  return count ?? 0
}

export interface ScanResult {
  entriesScanned: number
  entriesWithRefs: number
  refsWritten: number
  booksTouched: number
}

const PAGE = 500

/** Scan every entry, parse its references, and upsert them. `onProgress(done,total)`. */
export async function scanAllForRefs(
  onProgress?: (done: number, total: number) => void,
): Promise<ScanResult> {
  const sb = requireSupabase()

  const { count } = await sb.from('entries').select('*', { count: 'exact', head: true })
  const total = count ?? 0

  let scanned = 0
  let entriesWithRefs = 0
  let refsWritten = 0
  const books = new Set<string>()

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select('id, created_at, body_markdown')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as { id: string; created_at: string; body_markdown: string }[]
    if (rows.length === 0) break

    const refRows: Record<string, unknown>[] = []
    for (const e of rows) {
      const seen = new Set<string>()
      let added = 0
      for (const r of parseReferences(e.body_markdown)) {
        if (seen.has(r.osis_ref)) continue // dedup within an entry (the unique-index key)
        seen.add(r.osis_ref)
        books.add(r.book_osis)
        added++
        refRows.push({
          entry_id: e.id,
          book_osis: r.book_osis,
          book_name: r.book_name,
          book_order: r.book_order,
          chapter: r.chapter,
          verse_start: r.verse_start,
          verse_end: r.verse_end,
          osis_ref: r.osis_ref,
          entry_created_at: e.created_at,
          source: 'parsed',
          confidence: r.confidence,
          status: 'confirmed',
          char_start: r.char_start,
          char_end: r.char_end,
        })
      }
      if (added > 0) entriesWithRefs++
    }

    for (let i = 0; i < refRows.length; i += PAGE) {
      const chunk = refRows.slice(i, i + PAGE)
      // ignoreDuplicates: never clobber existing inline/command/manual rows.
      const { error: upErr } = await sb
        .from('scripture_refs')
        .upsert(chunk, { onConflict: 'entry_id,osis_ref', ignoreDuplicates: true })
      if (upErr) throw upErr
      refsWritten += chunk.length
    }

    scanned += rows.length
    onProgress?.(scanned, total)
    if (rows.length < PAGE) break
  }

  return { entriesScanned: scanned, entriesWithRefs, refsWritten, booksTouched: books.size }
}
