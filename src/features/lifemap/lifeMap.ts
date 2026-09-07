// The Life Map — four lists of what a journal is about, and where they come from.
//
// This module is PURE. It takes rows that already exist (the Concordance, which
// the engine populates silently, and `kept_subjects`, which is the writer
// answering) and arranges them into the four sections the surface renders.
// Nothing here queries; `loadLifeMap` in `useLifeMap.ts` does that and calls in.
//
// WHY IT COMPOSES RATHER THAN BUILDS: every piece was already here. The
// Concordance's `kind` enum is `person | place | org | project | term`, which is
// four of these sections with `org`/`project` unioned. Its `status`/`source`
// columns already encode provenance. `kept_subjects` is already the keep
// gesture, keyed `c:<name>` or `word:<typed>`. The Life Map is the first reader
// of tables that have been filling in the dark since June.
//
// See `docs/LIFE_MAP.md` for the surface spec and `docs/prototypes/life-map.html`
// for what it looks like.

import { type ConcordanceItem, type ConcordanceKind } from '@/lib/concordance'
import type { KeptSubject } from '@/features/pages/keptSubjects'
import { displayLabel } from '@/features/pages/subjects'

/** The four sections, in the order the surface shows them. */
export const SECTIONS = [
  {
    id: 'person',
    label: 'People',
    ask: 'add a name…',
    what: "Anyone you write about — family, friends, someone you're praying for.",
  },
  {
    id: 'place',
    label: 'Places',
    ask: 'add a place…',
    what: 'Where your life happens — home, the office, a sanctuary, a city.',
  },
  {
    id: 'domain',
    label: 'Domains',
    ask: 'add a domain…',
    what: 'The larger parts of your life. Most other things sit inside one of these.',
  },
  {
    id: 'matter',
    label: 'Matters',
    ask: "add what's going on…",
    what: "What's going on — a project, a season, a struggle, something you keep praying about.",
  },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

/**
 * Who put this here.
 *
 * The surface renders all three in amber-or-not, and the writer never has to
 * read a word to know which is which — see `docs/LIFE_MAP.md` § The one visual rule.
 */
export type Provenance =
  /** The writer typed it, or corrected the engine into it. */
  | 'mine'
  /** The engine offered it and the writer kept it. */
  | 'found'
  /** The engine offered it and the writer has not answered. */
  | 'waiting'

export interface LifeMapItem {
  /** Stable identity, shared with `kept_subjects.subject_key`. */
  key: string
  label: string
  section: SectionId
  provenance: Provenance
  /** Distinct pages this appears on. Shown; NEVER sorted by — see `order`. */
  pages: number
  /** From `entries.created_at`, so imports carry their original dates. */
  firstSeen: string | null
  lastSeen: string | null
  /** Every spelling that counts as a hit. */
  terms: string[]
}

export interface LifeMapSection {
  id: SectionId
  label: string
  ask: string
  what: string
  items: LifeMapItem[]
  /** How many of `items` the engine found — kept or waiting. */
  found: number
}

/**
 * `org` and `project` are one section.
 *
 * The Concordance splits them because a fidelity record cares whether "Frontier"
 * is a church or a codebase. A person reading their own life does not: both are
 * spheres they belong to, which is what a domain is.
 */
export function sectionFor(kind: ConcordanceKind): SectionId {
  switch (kind) {
    case 'person':
      return 'person'
    case 'place':
      return 'place'
    case 'org':
    case 'project':
      return 'domain'
    case 'term':
      return 'matter'
  }
}

/** The key `kept_subjects` stores for a Concordance row. Must match `subjectFromItem`. */
export const conKey = (canonical: string) => `c:${canonical.toLowerCase()}`

/**
 * Provenance, in the one order the checks may run.
 *
 * `explicit` wins over everything: a row the writer created is theirs even once
 * the engine has since confirmed it. Checking `status` first would relabel every
 * typed subject as something the machine found, which is the one claim this
 * surface must never make.
 */
export function provenanceOf(item: ConcordanceItem, keptKeys: ReadonlySet<string>): Provenance {
  if (item.source === 'explicit' || item.source === 'correction') return 'mine'
  if (item.status === 'confirmed' || keptKeys.has(conKey(item.canonical))) return 'found'
  return 'waiting'
}

/**
 * Ordering. Read the rule before changing it.
 *
 * NEVER BY PAGE COUNT. `kept_subjects`' migration says why, and it is the whole
 * reason that table has no sort column: "Riverside above Mom at 31 pages to 14
 * would be the app ranking what a person carries, and a ranking of the people in
 * someone's life is a verdict rendered in a sort (Principle 1)."
 *
 * EVERYTHING ORDERS BY WHEN IT FIRST APPEARED — chronology, which is a fact
 * about the journal rather than a judgement about the writer. `kept_subjects`
 * recommends `kept_at`, and that axis is right for its own list; here the list
 * is a superset that includes rows never explicitly kept, so `first_seen` is
 * the one axis all three provenances share. Both are non-evaluative, which is
 * the property that actually matters.
 *
 * Typed and found items sort TOGETHER. Ranking the writer's own names above the
 * ones the journal surfaced would be a hierarchy nobody asked for; the amber
 * already says which is which.
 *
 * `pages` is still SHOWN on every chip. Showing a count is arithmetic; sorting by
 * it is significance, and significance is a verdict (D-016). The distinction is
 * subtle and it is the only reason a count is allowed on this surface at all.
 */
function order(a: LifeMapItem, b: LifeMapItem): number {
  const waiting = (i: LifeMapItem) => (i.provenance === 'waiting' ? 1 : 0)
  if (waiting(a) !== waiting(b)) return waiting(a) - waiting(b)
  const at = a.firstSeen ?? ''
  const bt = b.firstSeen ?? ''
  if (at !== bt) return at < bt ? -1 : 1
  return a.label.localeCompare(b.label)
}

/** A Concordance row the surface must not show at all. */
const retired = (item: ConcordanceItem) =>
  item.status === 'dormant' || item.status === 'superseded'

/**
 * Build the four sections.
 *
 * `kept` contributes two things: it promotes a suggested Concordance row to
 * `found`, and it carries typed subjects (`word:` keys) that no Concordance row
 * backs — the ones the writer named before the engine ever saw them.
 */
export function buildLifeMap(
  concordance: readonly ConcordanceItem[],
  kept: readonly KeptSubject[],
): LifeMapSection[] {
  const keptKeys = new Set(kept.map((k) => k.key))
  const items: LifeMapItem[] = []
  const seen = new Set<string>()

  for (const item of concordance) {
    if (retired(item)) continue
    const key = conKey(item.canonical)
    if (seen.has(key)) continue
    seen.add(key)
    items.push({
      key,
      label: displayLabel(item.canonical, item.surface_forms),
      section: sectionFor(item.kind),
      provenance: provenanceOf(item, keptKeys),
      pages: item.occurrence_count,
      firstSeen: item.first_seen,
      lastSeen: item.last_seen,
      terms: item.surface_forms.length > 0 ? item.surface_forms : [item.canonical],
    })
  }

  // Typed subjects the engine has never seen. They have no occurrence count
  // until the next scan lights them, and a blank count is honest where a zero
  // would read as "nothing" about something the writer just told us matters.
  for (const k of kept) {
    if (!k.key.startsWith('word:') || seen.has(k.key)) continue
    seen.add(k.key)
    items.push({
      key: k.key,
      label: k.label,
      section: keptSection(k),
      provenance: 'mine',
      pages: 0,
      firstSeen: k.keptAt,
      lastSeen: null,
      terms: k.terms,
    })
  }

  return SECTIONS.map((s) => {
    const mine = items.filter((i) => i.section === s.id).sort(order)
    return {
      id: s.id,
      label: s.label,
      ask: s.ask,
      what: s.what,
      items: mine,
      found: mine.filter((i) => i.provenance !== 'mine').length,
    }
  })
}

/**
 * Which section a typed subject belongs in.
 *
 * `kept_subjects.kind` is nullable and was added by this feature; rows kept
 * before it existed have none. They fall to Matters rather than being dropped —
 * a subject the writer kept must never vanish because a column arrived late.
 */
function keptSection(k: KeptSubject): SectionId {
  const kind = (k as KeptSubject & { section?: string }).section
  return kind === 'person' || kind === 'place' || kind === 'domain' || kind === 'matter'
    ? kind
    : 'matter'
}

/** Totals for the footer. Counts only — the surface states no ratio and no rate. */
export function tallies(sections: readonly LifeMapSection[]) {
  const all = sections.flatMap((s) => s.items)
  return {
    mine: all.filter((i) => i.provenance === 'mine').length,
    found: all.filter((i) => i.provenance === 'found').length,
    waiting: all.filter((i) => i.provenance === 'waiting').length,
  }
}
