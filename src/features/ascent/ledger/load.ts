/**
 * Reading the ledger's sources. Everything here is a read the client already
 * has the right to make (RLS, owner-scoped); nothing is written, nothing is
 * sent to a model. The entries come from the local cache, so the costliest
 * part of the year — its pages — never touches the network.
 *
 * The owner-wide sources (threads, names, verses, answered prayers) are read
 * once per session and shared by every year on the rail. A sealed year's
 * ledger is kept for the session too; the open year is rebuilt each day,
 * because it is the one still moving.
 */

import { assertSameOwner, cacheGeneration, getCache, setCache } from '@/lib/asyncCache'
import { listEntries } from '@/lib/repo'
import { markingsForEntries } from '@/lib/spiritual'
import { requireSupabase } from '@/lib/supabase'
import { allSubjects, type Subject } from '@/features/pages/subjects'
import { listKeptSubjects, withVocabulary } from '@/features/pages/keptSubjects'
import {
  buildYearLedger,
  type EncounterInput,
  type MatterInput,
  type RefInput,
  type YearLedger,
} from './build'

const PAGE = 1000
const THREAD_IN_CHUNK = 80

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as T[]
    out.push(...batch)
    if (batch.length < PAGE) break
  }
  return out
}

/** Once per session per owner — a cached promise, so concurrent years share it. */
function once<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
  const hit = getCache<Promise<T>>(key)
  if (hit) return hit
  const p = load().catch((e) => {
    console.error(`[ledger] ${key}`, e instanceof Error ? e.message : e)
    return fallback
  })
  setCache(key, p)
  return p
}

interface ThreadRow {
  id: string
  label: string
  label_ai: string | null
  label_user: string | null
}
interface MemberRow {
  thread_id: string
  spiritual_item_id: string | null
  spiritual_items: { content: string; entry_id: string | null; type: string } | null
}

function loadMatters(): Promise<MatterInput[]> {
  return once('ledger:matters', async () => {
    const sb = requireSupabase()
    const threads = await pageAll<ThreadRow>((a, b) =>
      sb
        .from('threads')
        .select('id, label, label_ai, label_user')
        .eq('kind', 'declared')
        .eq('dismissed', false)
        .order('id', { ascending: true })
        .range(a, b),
    )
    const byId = new Map<string, MatterInput>(
      threads.map((t) => [t.id, { id: t.id, label: (t.label_user ?? t.label_ai ?? t.label).trim(), members: [] }]),
    )
    const ids = [...byId.keys()]
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += THREAD_IN_CHUNK) chunks.push(ids.slice(i, i + THREAD_IN_CHUNK))
    for (let i = 0; i < chunks.length; i += 4) {
      const wave = await Promise.all(
        chunks.slice(i, i + 4).map((chunk) =>
          pageAll<MemberRow>((a, b) =>
            sb
              .from('thread_members')
              .select('thread_id, spiritual_item_id, spiritual_items(content, entry_id, type)')
              .in('thread_id', chunk)
              .order('id', { ascending: true })
              .range(a, b),
          ),
        ),
      )
      for (const rows of wave) {
        for (const m of rows) {
          if (!m.spiritual_item_id || !m.spiritual_items) continue
          byId.get(m.thread_id)?.members.push({
            itemId: m.spiritual_item_id,
            entryId: m.spiritual_items.entry_id,
            content: m.spiritual_items.content,
            type: m.spiritual_items.type,
          })
        }
      }
    }
    return [...byId.values()].filter((t) => t.members.length > 0 && t.label.length > 0)
  }, [])
}

function loadNames(): Promise<Subject[]> {
  return once('ledger:names', async () => {
    const [vocabulary, kept] = await Promise.all([allSubjects(), listKeptSubjects().catch(() => [])])
    const byKey = new Map<string, Subject>()
    for (const s of vocabulary) byKey.set(s.key, s)
    // What the writer kept wins: their filing, their spellings.
    for (const s of withVocabulary(kept, vocabulary)) byKey.set(s.key, s)
    return [...byKey.values()]
  }, [])
}

interface RefRow {
  entry_id: string
  book_osis: string
  chapter: number
  osis_ref: string
  char_start: number | null
  char_end: number | null
}

function loadRefs(): Promise<RefInput[]> {
  return once('ledger:refs', async () => {
    const sb = requireSupabase()
    const rows = await pageAll<RefRow>((a, b) =>
      sb
        .from('scripture_refs')
        .select('entry_id, book_osis, chapter, osis_ref, char_start, char_end')
        .eq('status', 'confirmed')
        .order('id', { ascending: true })
        .range(a, b),
    )
    return rows.map((r) => ({
      entryId: r.entry_id,
      bookOsis: r.book_osis,
      chapter: r.chapter,
      osisRef: r.osis_ref,
      charStart: r.char_start,
      charEnd: r.char_end,
    }))
  }, [])
}

interface EncounterRow {
  thread_ref: string | null
  movement: string
  named_at: string
  source_entry_id: string | null
  reflection_text: string | null
}

function loadEncounters(): Promise<EncounterInput[]> {
  return once('ledger:encounters', async () => {
    const sb = requireSupabase()
    const rows = await pageAll<EncounterRow>((a, b) =>
      sb
        .from('encounters')
        .select('thread_ref, movement, named_at, source_entry_id, reflection_text')
        .not('thread_ref', 'is', null)
        .order('id', { ascending: true })
        .range(a, b),
    )
    return rows
      .filter((r) => r.thread_ref)
      .map((r) => ({
        threadId: r.thread_ref!,
        movement: r.movement,
        namedAt: r.named_at,
        sourceEntryId: r.source_entry_id,
        reflection: r.reflection_text,
      }))
  }, [])
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The ledger for one year. `now` decides whether it is the open year (built
 * through the current month) or sealed (all twelve).
 */
export async function loadYearLedger(year: number, now: Date = new Date()): Promise<YearLedger> {
  const open = year === now.getUTCFullYear()
  const key = open ? `ledger:year:${year}:${dayKey()}` : `ledger:year:${year}`
  const hit = getCache<YearLedger>(key)
  if (hit) return hit

  const gen = cacheGeneration()
  const [entries, matters, names, refs, encounters] = await Promise.all([
    listEntries(),
    loadMatters(),
    loadNames(),
    loadRefs(),
    loadEncounters(),
  ])
  const yearIds = entries.filter((e) => e.created_at.startsWith(String(year))).map((e) => e.id)
  const markings = await markingsForEntries(yearIds).catch(() => [])

  const ledger = buildYearLedger(
    {
      entries,
      matters,
      names,
      refs,
      markings: markings.map((m) => ({ entryId: m.entryId, type: m.type, content: m.content })),
      encounters,
    },
    year,
    open ? now.getUTCMonth() + 1 : 12,
  )
  assertSameOwner(gen)
  setCache(key, ledger)
  return ledger
}
