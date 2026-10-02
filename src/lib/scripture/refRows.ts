// What `scripture_refs` should hold for a page, given what it holds now.
//
// PURE, and shared on purpose. The editor's reconcile-on-save (capture.ts) and
// the server's gather engine (api/_lib/derive.ts) both decide here which
// references to insert and which to drop, so an imported page and a page typed
// in the editor are read by the same rule. Only the I/O differs between them.

import { parseReferences, type ParsedRef } from './parse.js'
import { fenceReferences, highlightRefs } from './highlights.js'

/** Sources that live in the body, so a reconcile owns them. 'manual' and
 *  'suggested' rows are never derived from prose and are never deleted here. */
export const PROSE_SOURCES: readonly string[] = ['parsed', 'inline', 'command']

export interface ExistingRefRow {
  id: string
  osis_ref: string
  source: string
}

export interface ScriptureRefRow {
  entry_id: string
  book_osis: string
  book_name: string
  book_order: number
  chapter: number
  verse_start: number | null
  verse_end: number | null
  osis_ref: string
  entry_created_at: string
  source: 'inline' | 'parsed'
  confidence: number
  status: 'confirmed'
  char_start: number
  char_end: number
}

/**
 * Every reference a page's body holds, in the order that decides which of two
 * equal ones is kept (`dedupeByOsis` keeps the first hit):
 *
 *  1. the verses highlighted in a scripture ritual — kept first, so a verse the
 *     writer drew out is excerpted from their reflection beside the quote
 *     rather than from the passage;
 *  2. each scripture fence's own reference line, read strictly;
 *  3. references found in prose.
 *
 * The one place this is decided: the editor's save, the gather engine, the
 * client-side scan of an import, the offline fallback and the backfill all call
 * it, so a page reads the same way however it arrived.
 */
export function scriptureRefsOf(markdown: string): ParsedRef[] {
  return [...highlightRefs(markdown), ...fenceReferences(markdown), ...parseReferences(markdown)]
}

/** Dedupe parsed refs by osis_ref (the unique-index key), keeping the first hit. */
export function dedupeByOsis(refs: ParsedRef[]): Map<string, ParsedRef> {
  const out = new Map<string, ParsedRef>()
  for (const r of refs) if (!out.has(r.osis_ref)) out.set(r.osis_ref, r)
  return out
}

/**
 * Reconcile plan for one entry: the rows to insert (references in the body with
 * no row yet) and the ids to delete (prose-derived rows whose reference is no
 * longer in the body).
 *
 * `source` records who noticed: 'inline' for the editor's save, 'parsed' for a
 * scan of a page that never passed through the editor.
 */
export function planScriptureRefs(
  entryId: string,
  entryCreatedAt: string,
  markdown: string,
  existing: ExistingRefRow[],
  source: 'inline' | 'parsed',
): { toInsert: ScriptureRefRow[]; toDelete: string[] } {
  const parsed = dedupeByOsis(scriptureRefsOf(markdown))
  const existingOsis = new Set(existing.map((e) => e.osis_ref))

  const toInsert = [...parsed.values()]
    .filter((r) => !existingOsis.has(r.osis_ref))
    .map((r) => ({
      entry_id: entryId,
      book_osis: r.book_osis,
      book_name: r.book_name,
      book_order: r.book_order,
      chapter: r.chapter,
      verse_start: r.verse_start,
      verse_end: r.verse_end,
      osis_ref: r.osis_ref,
      entry_created_at: entryCreatedAt,
      source,
      confidence: r.confidence,
      status: 'confirmed' as const,
      char_start: r.char_start,
      char_end: r.char_end,
    }))

  const toDelete = existing
    .filter((e) => PROSE_SOURCES.includes(e.source) && !parsed.has(e.osis_ref))
    .map((e) => e.id)

  return { toInsert, toDelete }
}
