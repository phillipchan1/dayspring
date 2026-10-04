// The entry read, as a gather step — the Keeping read (keepingRead.ts) run by the
// engine on the same snapshot of the body as the harvest and the concordance,
// and STORED in entry_reads. Behind GATHER_READ (D-035, docs/GATHER.md § The read).
//
// What is stored is exactly what the read returns after sanitizeKeepingRead: every
// quote an exact substring of the page, emotions only with their evidence, denied
// emotions dropped, subjects only from the writer's own vocabulary. Nothing is
// re-worded on the way in.
//
// A page whose read throws is reported back to the engine as failed, which counts
// an attempt against it exactly like a failed harvest — retried alone, given up
// at the cap. Logs counts only, never entry text (§8).

import type { SupabaseClient } from '@supabase/supabase-js'
import { readEntryWithKeeping, type EntryReading } from './keepingRead.js'
import { candidatesForEntry, loadVocabulary, type Vocabulary } from './keepingVocabulary.js'

/** Reads in flight at once. One model call per page; a tick of 24 is ~6 rounds. */
export const READ_POOL = 4

export interface ReadInput {
  id: string
  created_at: string
  body_markdown: string
  /** md5 of the writer's own words — what the stored read is keyed to. */
  wordsHash: string
}

export interface EntryReadRow {
  entry_id: string
  owner: string
  version: string
  words_hash: string
  truncated: boolean
  present: boolean
  valence: number
  activation: number
  confidence: number
  emotions: EntryReading['sentiment']['emotions']
  ingredients: { kind: string; quote: string; confidence: number; movement: string }[]
  movements: EntryReading['movements']
  read_at: string
}

/** The row for one read. PURE — exported for the tests and the dry run. */
export function readRow(owner: string, wordsHash: string, reading: EntryReading, now = new Date()): EntryReadRow {
  return {
    entry_id: reading.entryId,
    owner,
    version: reading.version,
    words_hash: wordsHash,
    truncated: reading.truncated,
    present: reading.sentiment.present,
    valence: reading.sentiment.valence,
    activation: reading.sentiment.activation,
    confidence: reading.sentiment.confidence,
    emotions: reading.sentiment.emotions,
    ingredients: reading.movements.flatMap((m) =>
      m.ingredients.map((i) => ({ kind: i.kind, quote: i.quote, confidence: i.confidence, movement: m.id })),
    ),
    movements: reading.movements,
    read_at: now.toISOString(),
  }
}

async function mapPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
}

export interface ReadDeps {
  vocabulary?: Vocabulary
  read?: typeof readEntryWithKeeping
}

/**
 * Read a set of one owner's pages without writing anything. The engine stores
 * the rows; the dry run prints them.
 */
export async function readPages(
  sb: SupabaseClient,
  owner: string,
  entries: ReadInput[],
  deps: ReadDeps = {},
): Promise<{ rows: EntryReadRow[]; failedIds: string[] }> {
  if (entries.length === 0) return { rows: [], failedIds: [] }
  const vocabulary = deps.vocabulary ?? (await loadVocabulary(sb, owner))
  const read = deps.read ?? readEntryWithKeeping
  const rows: EntryReadRow[] = []
  const failedIds: string[] = []
  await mapPool(entries, READ_POOL, async (e) => {
    try {
      const subjects = candidatesForEntry(e.body_markdown, vocabulary.concordance, vocabulary.kept)
      const reading = await read({ id: e.id, created_at: e.created_at, body_markdown: e.body_markdown }, subjects)
      rows.push(readRow(owner, e.wordsHash, reading))
    } catch {
      failedIds.push(e.id)
    }
  })
  return { rows, failedIds }
}

/** Store reads, replacing each page's previous read. Throws on a database error. */
export async function storeReads(sb: SupabaseClient, rows: EntryReadRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await sb.from('entry_reads').upsert(rows.slice(i, i + 50), { onConflict: 'entry_id' })
    if (error) throw error
  }
}

/** Read and store — the engine's step. */
export async function readEntries(
  sb: SupabaseClient,
  owner: string,
  entries: ReadInput[],
  deps: ReadDeps = {},
): Promise<{ read: number; failedIds: string[] }> {
  const { rows, failedIds } = await readPages(sb, owner, entries, deps)
  await storeReads(sb, rows)
  return { read: rows.length, failedIds }
}
