// What the bench reads. Its own loader on purpose: this is an internal surface
// and threading it through the app's data seams would make six files carry a
// dependency on something no user will ever open.
//
// Every query is owner-scoped by RLS through the ordinary anon client — the
// bench sees exactly what the app sees, which is the point. If it read with
// more privilege than the product does, it would stop measuring the product.

import { listConcordance, type ConcordanceItem } from '@/lib/concordance'
import { requireSupabase } from '@/lib/supabase'
import type { BenchMarking, BenchMatter } from './measure'

export interface BenchData {
  bodies: Map<string, string>
  markings: BenchMarking[]
  byEntry: Map<string, BenchMarking[]>
  concordance: ConcordanceItem[]
  matters: BenchMatter[]
  /**
   * Whether `spiritual_items.char_start` exists yet. The bench is useful before
   * the migration lands — it just falls back to the verbatim search — and
   * saying so is better than quietly reporting zero located markings.
   */
  positionsMigrated: boolean
}

const PAGE = 1000

async function pageAll<T>(table: string, columns: string): Promise<T[]> {
  const sb = requireSupabase()
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

interface EntryRow { id: string; body_markdown: string | null }
interface ItemRow {
  id: string
  entry_id: string | null
  type: BenchMarking['type']
  content: string | null
  source: string | null
  char_start?: number | null
}
interface ThreadRow { label: string; subject_kind: string | null; weight: number | null }

export async function loadBench(): Promise<BenchData> {
  const entries = await pageAll<EntryRow>('entries', 'id, body_markdown')

  // Ask for the offset column and fall back if the migration has not run. A
  // missing column is a 42703 from PostgREST, not an empty result, so it has to
  // be caught rather than checked for.
  let positionsMigrated = true
  let items: ItemRow[]
  try {
    items = await pageAll<ItemRow>(
      'spiritual_items',
      'id, entry_id, type, content, source, char_start',
    )
  } catch {
    positionsMigrated = false
    items = await pageAll<ItemRow>('spiritual_items', 'id, entry_id, type, content, source')
  }

  const [concordance, threads] = await Promise.all([
    listConcordance(),
    pageAll<ThreadRow>('threads', 'label, subject_kind, weight, kind').then((rows) =>
      (rows as (ThreadRow & { kind?: string })[]).filter((t) => t.kind === 'declared'),
    ),
  ])

  const markings: BenchMarking[] = items.map((r) => ({
    id: r.id,
    entryId: r.entry_id,
    type: r.type,
    content: r.content ?? '',
    source: r.source,
    charStart: r.char_start ?? null,
  }))

  const byEntry = new Map<string, BenchMarking[]>()
  for (const m of markings) {
    if (!m.entryId) continue
    const held = byEntry.get(m.entryId)
    if (held) held.push(m)
    else byEntry.set(m.entryId, [m])
  }

  return {
    bodies: new Map(entries.map((e) => [e.id, e.body_markdown ?? ''])),
    markings,
    byEntry,
    concordance,
    matters: threads.map((t) => ({
      label: t.label,
      kind: t.subject_kind,
      weight: t.weight ?? 0,
    })),
    positionsMigrated,
  }
}

/**
 * The subjects worth offering in the join panel: matters by how often they were
 * brought, then names by how often they recur.
 *
 * Order here is a convenience for finding a subject in a list, and nothing is
 * shown to a reader as a ranking — the ordering rule `kept_subjects` sets
 * (never a count) governs what the PRODUCT shows, not an internal picker.
 */
export function benchSubjects(data: BenchData): { label: string; origin: 'matter' | 'name' }[] {
  const matters = [...data.matters]
    .sort((a, b) => b.weight - a.weight)
    .map((m) => ({ label: m.label, origin: 'matter' as const }))
  const seen = new Set(matters.map((m) => m.label.toLowerCase()))
  const names = [...data.concordance]
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .filter((c) => !seen.has(c.canonical.toLowerCase()))
    .map((c) => ({ label: c.canonical, origin: 'name' as const }))
  return [...matters, ...names]
}
