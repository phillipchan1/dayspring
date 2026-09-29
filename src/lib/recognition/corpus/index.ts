// The import-recognition corpus — assembled, dated, and ready for both tiers.
//
// Import CORPUS (or one of the helpers) from here; the per-category files are
// an authoring convenience, not an interface.

import type { CorpusEntry, DefectId, LoadedEntry } from './types'
import { SCRIPTURE_ENTRIES } from './scripture'
import { PRAYER_ENTRIES } from './prayers'
import { ENTITY_ENTRIES } from './entities'
import { SUBJECT_ENTRIES } from './subjects'
import { ORDINARY_ENTRIES } from './ordinary'
import { SENTIMENT_ENTRIES } from './sentiment'
import { PRAYER_HARD_ENTRIES } from './prayers-hard'
import { SUBJECT_HARD_ENTRIES } from './subjects-hard'
import { ADVERSARIAL_ENTRIES } from './adversarial'

const RAW: CorpusEntry[] = [
  ...SCRIPTURE_ENTRIES,
  ...PRAYER_ENTRIES,
  ...ENTITY_ENTRIES,
  ...SUBJECT_ENTRIES,
  ...ORDINARY_ENTRIES,
  ...SENTIMENT_ENTRIES,
  ...PRAYER_HARD_ENTRIES,
  ...SUBJECT_HARD_ENTRIES,
  ...ADVERSARIAL_ENTRIES,
]

/**
 * Monday 5 January 2026 — the same epoch api/_lib/declared.test.ts anchors its
 * `line()` helper to, so a reviewer reading both files sees one calendar.
 */
export const EPOCH_MS = Date.UTC(2026, 0, 5)

const DAY_MS = 86_400_000

/** ISO week key ('2026-W02') — the unit declared.ts's MIN_WEEKS gate counts. */
function isoWeekKey(iso: string): string {
  const d = new Date(iso)
  // ISO weeks: Thursday decides the year, Monday starts the week.
  const thursday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3),
  )
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS) -
        ((firstThursday.getUTCDay() + 6) % 7) / 7,
    )
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function load(e: CorpusEntry): LoadedEntry {
  const created_at = new Date(EPOCH_MS + (e.week * 7 + e.day) * DAY_MS).toISOString()
  const nothing = e.yieldsNothing === true
  return {
    ...e,
    created_at,
    isoWeek: isoWeekKey(created_at),
    ...(nothing ? { refs: [], passages: [], entities: [], subjects: [] } : {}),
  }
}

/** Every corpus entry, dated, oldest first — the order an import would land in. */
export const CORPUS: readonly LoadedEntry[] = RAW.map(load).sort((a, b) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1,
)

export type Axis = 'refs' | 'passages' | 'entities' | 'subjects' | 'sentiment'

/**
 * Frozen 60/40 dev/test split from a hash of the entry id. Tune Jev criteria
 * and τ only on `dev`; report on `test`.
 */
export function splitForId(id: string): 'dev' | 'test' {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100 < 60 ? 'dev' : 'test'
}

export function filterSplit<T extends { id: string }>(
  rows: readonly T[],
  split: 'dev' | 'test' | 'all',
): T[] {
  if (split === 'all') return [...rows]
  return rows.filter((r) => splitForId(r.id) === split)
}

/**
 * Round-robin sample across categories so `--limit=N` still hits every
 * corpus bucket it can, instead of taking the first N rows in date order.
 */
export function stratifiedSample<T>(
  items: readonly T[],
  n: number,
  categoryOf: (item: T) => string,
): T[] {
  if (!Number.isFinite(n) || n <= 0) return []
  if (n >= items.length) return [...items]
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = categoryOf(item)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  const keys = [...groups.keys()].sort()
  const cursor = new Map<string, number>(keys.map((k) => [k, 0]))
  const out: T[] = []
  while (out.length < n) {
    let progressed = false
    for (const key of keys) {
      const group = groups.get(key)!
      const i = cursor.get(key) ?? 0
      if (i < group.length) {
        out.push(group[i]!)
        cursor.set(key, i + 1)
        progressed = true
        if (out.length >= n) break
      }
    }
    if (!progressed) break
  }
  return out
}

/**
 * Entries annotated on `axis`. Entries that omit the axis are excluded — an
 * omitted axis means "not annotated here", which is not the same as "yields
 * nothing", and scoring an unannotated entry would invent both a denominator
 * and a false positive.
 */
export function corpusFor(axis: Axis): LoadedEntry[] {
  return CORPUS.filter((e) => e[axis] !== undefined)
}

/**
 * Exactly the row shape the three builders select from Supabase
 * (`id, created_at, body_markdown`), so Tier 2 can hand these straight to the
 * DB-free seams with no adapter in between.
 */
export function asEntryRows(): { id: string; created_at: string; body_markdown: string }[] {
  return CORPUS.map((e) => ({ id: e.id, created_at: e.created_at, body_markdown: e.body }))
}

/**
 * What each pinned defect costs, and which entries demonstrate it. Reports read
 * this so a number always comes with the thing it means.
 */
export const DEFECTS: Record<DefectId, { summary: string; entryIds: string[] }> = (() => {
  const summaries: Record<DefectId, string> = {
    'ambiguous-word-needs-verse':
      'A book name that is also an ordinary word needs a verse or "chapter" to be admitted, so "Acts 2" alone is missed.',
    'crosschapter-range': 'Only the first chapter of a chapter range is recorded.',
    'bare-book-no-chapter': 'Reading a whole book with no chapter cited registers as nothing.',
    'anchorless-verse-marker': 'The verses actually dwelt on ("vv. 4-5") have no anchor and vanish.',
    'allusion-undetected': 'Quoted scripture with no address. No detector exists.',
    'cue-blind-prayer': 'A genuine prayer whose wording trips none of HARVEST_CUE; never reaches the model.',
  }
  const out = {} as Record<DefectId, { summary: string; entryIds: string[] }>
  for (const [id, summary] of Object.entries(summaries) as [DefectId, string][]) {
    out[id] = { summary, entryIds: CORPUS.filter((e) => e.defect === id).map((e) => e.id) }
  }
  return out
})()

/**
 * Subjects designed to clear declared.ts's recurrence gates (MIN_TOUCHES = 3
 * touches across MIN_WEEKS = 3 distinct ISO weeks), and subjects designed to
 * fall just short. Both halves matter: a pipeline that forms every thread it
 * sees is as broken as one that forms none.
 */
export const DESIGNED_THREADS = {
  /** Must form. */
  forms: ['Naomi', 'Frontier', 'anxiety'] as const,
  /** Must NOT form, with the gate each one fails. */
  nearMisses: [
    { label: 'the move', fails: 'MIN_WEEKS — four touches, all inside one ISO week' },
    { label: 'Bristol', fails: 'MIN_TOUCHES — two touches, eight weeks apart' },
  ] as const,
}

export type { CorpusEntry, LoadedEntry, DefectId } from './types'
export type {
  ExpectedRef,
  ExpectedPassage,
  ExpectedEntity,
  ExpectedSubject,
  ExpectedSentiment,
  Category,
  CorpusEmotion,
} from './types'
export { CORPUS_EMOTIONS } from './types'
