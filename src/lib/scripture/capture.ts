// Live capture of scripture references from entry prose. Reconcile-on-save,
// mirroring syncSpiritualBlocksFromMarkdown: when an entry is saved we re-parse
// its body and bring scripture_refs in line with it — insert newly-typed refs,
// remove ones the user deleted. This rides the existing save flow and leaves the
// sync engine / outbox untouched.
//
// Seam for later: if refs ever need true offline parity, this is the function to
// reroute through the IndexedDB outbox instead of writing supabase directly.
//
// Provenance: 'parsed' (backfill) and 'inline' (this) and 'command' (/scripture)
// all live in the body, so reconcile manages them. 'manual' and 'suggested'
// (allusions) are never derived from prose, so reconcile never deletes them.

import * as cache from '../db'
import { requireSupabase } from '../supabase'
import { parseReferences } from './parse'
import { dedupeByOsis, planScriptureRefs, type ExistingRefRow } from './refRows'

async function entryDate(entryId: string): Promise<string> {
  const entry = await cache.cacheGet(entryId)
  return entry?.created_at ?? new Date().toISOString()
}

/**
 * Reconcile scripture_refs with the references in an entry's body after save.
 * Inserts newly-typed refs as `inline`; deletes prose-derived rows whose ref is
 * no longer in the text. Owner is set by the table default (auth.uid()).
 */
export async function syncScriptureRefsFromMarkdown(
  entryId: string | null,
  markdown: string,
): Promise<void> {
  if (!entryId) return
  const sb = requireSupabase()

  const { data, error } = await sb
    .from('scripture_refs')
    .select('id, osis_ref, source')
    .eq('entry_id', entryId)
  if (error) throw error
  const existing = (data ?? []) as ExistingRefRow[]

  // The decision is the shared planner's (refRows.ts) — the server's gather
  // engine reads an imported page by the same rule.
  const { toInsert, toDelete } = planScriptureRefs(
    entryId,
    await entryDate(entryId),
    markdown,
    existing,
    'inline',
  )

  if (toInsert.length > 0) {
    const { error: insErr } = await sb.from('scripture_refs').insert(toInsert)
    if (insErr) throw insErr
  }
  if (toDelete.length > 0) {
    const { error: delErr } = await sb.from('scripture_refs').delete().in('id', toDelete)
    if (delErr) throw delErr
  }
}

/**
 * Persist a `command`-sourced ref when /scripture surfaces a passage. Upserts on
 * the (entry_id, osis_ref) unique index so it never duplicates an existing row.
 * The passage's reference text also lands in the entry body (a fence block), so
 * reconcile keeps this row alive until the block is removed.
 */
export async function recordScriptureCommandRef(
  entryId: string | null,
  reference: string,
): Promise<void> {
  if (!entryId) return
  const parsed = dedupeByOsis(parseReferences(reference))
  if (parsed.size === 0) return
  const sb = requireSupabase()
  const created_at_src = await entryDate(entryId)

  const rows = [...parsed.values()].map((r) => ({
    entry_id: entryId,
    book_osis: r.book_osis,
    book_name: r.book_name,
    book_order: r.book_order,
    chapter: r.chapter,
    verse_start: r.verse_start,
    verse_end: r.verse_end,
    osis_ref: r.osis_ref,
    entry_created_at: created_at_src,
    source: 'command' as const,
    confidence: 1,
    status: 'confirmed' as const,
    char_start: null,
    char_end: null,
  }))

  const { error } = await sb
    .from('scripture_refs')
    .upsert(rows, { onConflict: 'entry_id,osis_ref', ignoreDuplicates: true })
  if (error) throw error
}
