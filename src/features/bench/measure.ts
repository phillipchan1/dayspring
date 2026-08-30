// What the engine is actually producing, counted.
//
// Everything here is a pure function over rows the client already holds, and
// every number is a count of a mechanical defect in our own derived tables.
// None of it is a quality score of anyone's journal — the distinction
// `verify-pages-data.ts` draws in its header, and it is the whole reason this
// can be looked at without breaking Principle 1.
//
// Kept separate from the view so it can be tested. A bench whose measurements
// are only as good as a screenshot is not an instrument.

import type { ConcordanceItem } from '@/lib/concordance'
import { markingsNearSubject, type LocatableMarking } from '@/lib/subjectJoin'
import type { SpiritualItemType } from '@/lib/types'

// ── markings ─────────────────────────────────────────────────────────────────

export interface BenchMarking extends LocatableMarking {
  entryId: string | null
  /** 'command' (or null) is editor-written; 'scanned' the journal noticed. */
  source: string | null
}

export interface MarkingReport {
  total: number
  byKind: { kind: SpiritualItemType; count: number }[]
  declared: number
  scanned: number
  /** Has a stored offset — the join can place it as arithmetic. */
  located: number
  /** No offset, but its text is still findable in the page. */
  findable: number
  /** Neither. Counted, never hidden: these are invisible to every surface. */
  unplaceable: number
  orphaned: number
}

export function measureMarkings(
  markings: readonly BenchMarking[],
  bodies: ReadonlyMap<string, string>,
): MarkingReport {
  const kinds = new Map<SpiritualItemType, number>()
  let declared = 0
  let scanned = 0
  let located = 0
  let findable = 0
  let unplaceable = 0
  let orphaned = 0

  for (const m of markings) {
    kinds.set(m.type, (kinds.get(m.type) ?? 0) + 1)
    if (m.source === 'scanned') scanned++
    else declared++

    const body = m.entryId ? bodies.get(m.entryId) : undefined
    if (body === undefined) {
      orphaned++
      continue
    }
    if (m.charStart != null) located++
    else if (m.content.trim().length >= 12 && body.includes(m.content.trim())) findable++
    else unplaceable++
  }

  return {
    total: markings.length,
    byKind: [...kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
    declared,
    scanned,
    located,
    findable,
    unplaceable,
    orphaned,
  }
}

// ── the two vocabularies ─────────────────────────────────────────────────────

/** A subject the Altar derived from prayer and sense lines — a MATTER. */
export interface BenchMatter {
  label: string
  kind: string | null
  weight: number
}

export interface VocabularyReport {
  names: number
  matters: number
  /** Labels both vocabularies know. */
  shared: string[]
  /** Matters no name-finder could ever reach — nobody capitalises "marriage". */
  mattersOnly: number
  /** One name filed under two kinds: two half-lit piles of the same person. */
  kindSplits: { canonical: string; kinds: string[] }[]
  /** A surface form that is a pronoun, which lights every page in the archive. */
  pronounForms: { canonical: string; forms: string[] }[]
}

/**
 * Pronouns and bare articles have no business being a subject's spelling.
 * Measured on the real archive, the row for `esther` had absorbed both `her`
 * and `Him` — a reach for recall that costs precision on every other subject.
 */
const PRONOUNS = new Set([
  'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'theirs',
  'it', 'its', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours', 'i', 'me', 'my', 'mine',
  'this', 'that', 'these', 'those', 'the', 'a', 'an',
])

export function measureVocabulary(
  concordance: readonly ConcordanceItem[],
  matters: readonly BenchMatter[],
): VocabularyReport {
  const names = new Map<string, Set<string>>()
  for (const c of concordance) {
    const key = c.canonical.toLowerCase()
    const held = names.get(key)
    if (held) held.add(c.kind)
    else names.set(key, new Set([c.kind]))
  }

  const matterLabels = new Set(matters.map((m) => m.label.toLowerCase()))
  const shared = [...matterLabels].filter((l) => names.has(l)).sort()

  const kindSplits = [...names.entries()]
    .filter(([, ks]) => ks.size > 1)
    .map(([canonical, ks]) => ({ canonical, kinds: [...ks].sort() }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical))

  const pronounForms = concordance
    .map((c) => ({
      canonical: c.canonical,
      forms: (c.surface_forms ?? []).filter((f) => PRONOUNS.has(f.trim().toLowerCase())),
    }))
    .filter((r) => r.forms.length > 0)
    .sort((a, b) => b.forms.length - a.forms.length)

  return {
    names: names.size,
    matters: matterLabels.size,
    shared,
    mattersOnly: matterLabels.size - shared.length,
    kindSplits,
    pronounForms,
  }
}

// ── the join ─────────────────────────────────────────────────────────────────

export interface JoinReport {
  /** Pages naming the subject at all. */
  pages: number
  /** Markings on those pages — what page-level co-occurrence would return. */
  onPage: number
  /** Markings within `within` lines of a mention — what the join returns. */
  near: number
  /** How many survive at each distance, 0 first. */
  histogram: number[]
  byKind: { kind: SpiritualItemType; count: number }[]
}

/**
 * Run the real join across an archive and report what it discriminates.
 *
 * The point of the histogram is to make `NEAR_LINES` an argued number rather
 * than an inherited one: it shows exactly what widening or narrowing would
 * admit, on this writer's own pages.
 */
export function measureJoin(
  bodies: ReadonlyMap<string, string>,
  byEntry: ReadonlyMap<string, BenchMarking[]>,
  match: RegExp,
  within: number,
): JoinReport {
  let pages = 0
  let onPage = 0
  const histogram: number[] = Array.from({ length: within + 1 }, () => 0)
  const kinds = new Map<SpiritualItemType, number>()
  let near = 0

  for (const [entryId, body] of bodies) {
    const rx = new RegExp(match.source, match.flags.replace('g', ''))
    if (!rx.test(body)) continue
    pages++
    const here = byEntry.get(entryId) ?? []
    onPage += here.length
    for (const hit of markingsNearSubject(body, match, here, within)) {
      near++
      histogram[hit.distance] = (histogram[hit.distance] ?? 0) + 1
      kinds.set(hit.type, (kinds.get(hit.type) ?? 0) + 1)
    }
  }

  return {
    pages,
    onPage,
    near,
    histogram,
    byKind: [...kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/** Whole-word, case-insensitive, escaped — the same shape Pages lights with. */
export function subjectMatcher(term: string): RegExp {
  const safe = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${safe}\\b`, 'gi')
}
