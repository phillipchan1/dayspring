// The server's copy of what a SAVE derives from an entry's body — with no model
// and no tokens: the fenced prayer/sense/… blocks become `spiritual_items`, and
// the Scripture references in the prose become `scripture_refs`.
//
// ── Why the server does this at all ──────────────────────────────────────────
//
// In the editor this runs on every save (src/lib/entryDerive.ts). An IMPORTED
// entry never passes through the editor: it is bulk-upserted straight to the
// table, so a restored backup's `/pray` blocks produced no Altar rows at all,
// and its Scripture references depended on a scan that ran in the browser and
// stopped if the tab closed. Running the same derivation inside the gather
// engine means a page is read the same way however it arrived, and finishes
// unattended.
//
// ── One rule, two callers ────────────────────────────────────────────────────
//
// The decisions are NOT restated here. `spiritualBlockRows` and
// `planScriptureRefs` are the planners the editor's own reconcile uses; this
// file only does the I/O with the service role. (api/ imports these two pure
// modules from src/ the way api/circumstances/snap.ts imports its own — their
// import chains carry `.js` extensions so they resolve under Node ESM.)
//
// ── ADDITIVE, on purpose ─────────────────────────────────────────────────────
//
// The editor's reconcile also DELETES: a row whose fence the writer removed, a
// reference no longer in the prose. The server never does. An edit always comes
// from a client, whose own save has already pruned — and the server can be
// looking at a body one sync behind a row the popover wrote a moment ago
// (`/pray` writes its row over the network before the body carrying its fence
// has synced). Deleting from here could erase a prayer the writer just typed.
// Adding is always safe: every write below is an idempotent upsert.

import type { SupabaseClient } from '@supabase/supabase-js'
import { spiritualBlockRows, type SpiritualBlockRow } from '../../src/lib/spiritualBlocks.js'
import { planScriptureRefs, type ExistingRefRow } from '../../src/lib/scripture/refRows.js'

// Max ids in one `.in(...)` filter — they travel in the URL (see altar.ts).
const IN_CHUNK = 150

export interface DeriveResult {
  /** Fence rows written (inserted or refreshed). */
  items: number
  /** Scripture references inserted. */
  refs: number
  /** Fence ids that already belong to ANOTHER account, and were left alone. */
  foreign: number
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Derive fence rows + scripture refs for a set of one owner's entries.
 * Throws on a database error (the caller's chunk fails and is retried whole —
 * everything here is idempotent).
 */
export async function deriveEntries(
  sb: SupabaseClient,
  owner: string,
  entries: { id: string; created_at: string; body_markdown: string }[],
): Promise<DeriveResult> {
  const result: DeriveResult = { items: 0, refs: 0, foreign: 0 }
  if (entries.length === 0) return result

  // ── fences → spiritual_items ───────────────────────────────────────────────
  const planned: SpiritualBlockRow[] = entries.flatMap((e) =>
    spiritualBlockRows(owner, e.id, e.body_markdown ?? ''),
  )
  if (planned.length > 0) {
    // A fence carries its own row id. A backup restored into a DIFFERENT account
    // carries ids that already exist under the original owner — and the service
    // role bypasses the RLS that stops the editor overwriting them. So look
    // first, and never touch a row that is not this owner's.
    const foreign = new Set<string>()
    for (const ids of chunked([...new Set(planned.map((r) => r.id))], IN_CHUNK)) {
      const { data, error } = await sb.from('spiritual_items').select('id, owner').in('id', ids)
      if (error) throw error
      for (const row of (data ?? []) as { id: string; owner: string }[]) {
        if (row.owner !== owner) foreign.add(row.id)
      }
    }
    // One row per id: a page with the same fence pasted twice keeps the first.
    const byId = new Map<string, SpiritualBlockRow>()
    for (const r of planned) if (!foreign.has(r.id) && !byId.has(r.id)) byId.set(r.id, r)
    const rows = [...byId.values()]
    result.foreign = foreign.size
    if (rows.length > 0) {
      const { error } = await sb.from('spiritual_items').upsert(rows, { onConflict: 'id' })
      if (error) throw error
      result.items = rows.length
    }
  }

  // ── prose → scripture_refs ─────────────────────────────────────────────────
  const existingByEntry = new Map<string, ExistingRefRow[]>()
  for (const ids of chunked(entries.map((e) => e.id), IN_CHUNK)) {
    const { data, error } = await sb
      .from('scripture_refs')
      .select('id, entry_id, osis_ref, source')
      .in('entry_id', ids)
    if (error) throw error
    for (const row of (data ?? []) as (ExistingRefRow & { entry_id: string })[]) {
      const list = existingByEntry.get(row.entry_id)
      if (list) list.push(row)
      else existingByEntry.set(row.entry_id, [row])
    }
  }
  const toInsert = entries.flatMap((e) =>
    planScriptureRefs(
      e.id,
      e.created_at,
      e.body_markdown ?? '',
      existingByEntry.get(e.id) ?? [],
      'parsed',
    ).toInsert.map((r) => ({ ...r, owner })),
  )
  for (const rows of chunked(toInsert, 500)) {
    // (entry_id, osis_ref) is the table's unique key: a row the editor wrote in
    // the meantime is left exactly as it is.
    const { error } = await sb
      .from('scripture_refs')
      .upsert(rows, { onConflict: 'entry_id,osis_ref', ignoreDuplicates: true })
    if (error) throw error
    result.refs += rows.length
  }

  return result
}
