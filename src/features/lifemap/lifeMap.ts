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
import { displayLabel, isAddressee } from '@/features/pages/subjects'

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
  /** Dayspring found it. In by default — the writer removes it if it is wrong. */
  | 'found'

export interface LifeMapItem {
  /** Stable identity, shared with `kept_subjects.subject_key`. */
  key: string
  /** The Concordance row, when one backs this. Null for a typed subject.
   *  Removing a found item supersedes this row so it stops being offered. */
  id: string | null
  label: string
  section: SectionId
  provenance: Provenance
  /** Distinct pages this appears on. Shown; NEVER sorted by — see `order`. */
  pages: number
  /** No occurrence in a year. Rendered quietly; never hidden. */
  dormant: boolean
  /** Which era it is filed under. See `eraOf`. */
  era: Era
  /** From `entries.created_at`, so imports carry their original dates. */
  firstSeen: string | null
  lastSeen: string | null
  /** Every spelling that counts as a hit. */
  terms: string[]
}

/**
 * The era split, which is `DORMANT_AFTER_DAYS: 365` made visible.
 *
 * No buckets to invent and no boundary to defend: "written in the last year" is
 * a line the schema already draws, and on this archive it falls at 341 current
 * against 915 earlier. A three- or four-bucket scheme would need an interior
 * boundary nobody can justify, and the data does not cluster there anyway.
 *
 * FILED, NOT HIDDEN. An era is where something sits, not whether it exists. The
 * surface shows `earlier` behind one expander per section, with its count on
 * screen — the list is short by a stated rule the reader can overrule.
 */
export type Era = 'current' | 'earlier'

export interface LifeMapSection {
  id: SectionId
  label: string
  ask: string
  what: string
  /** The current era — what the section shows at rest. */
  items: LifeMapItem[]
  /** Filed behind the expander. Never dropped. */
  earlier: LifeMapItem[]
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

/**
 * The floor: how often something has to appear before it is offered.
 *
 * ONE PAGE IN A HUNDRED, the same constant and the same reasoning as
 * `readings.ts`' WORD_FLOOR — which learned this on this exact archive:
 * "Two pages is the right floor on a fixture of 47 entries and badly wrong on a
 * real archive." Measured 2026-09-07: the Concordance's own floor of 2 offers
 * 1,256 subjects, which is a wall of homework; one in a hundred offers 46.
 *
 * A FLOOR IS FILTERING. "The most significant thirty" would be ranking, and
 * ranking is a verdict (D-016). That is the whole difference, and it is why the
 * floor is STATED ON SCREEN and the writer can lower it — the list shortens by a
 * rule they can see and overrule, never by the app's opinion of who matters.
 */
export const FLOOR_RATIO = 0.01

/** Minimum 3, so a young journal offers something rather than nothing. */
export function floorFor(pageCount: number): number {
  return Math.max(3, Math.round(pageCount * FLOOR_RATIO))
}

/** The key `kept_subjects` stores for a Concordance row. Must match `subjectFromItem`. */
export const conKey = (canonical: string) => `c:${canonical.toLowerCase()}`

/**
 * Provenance — two states, because WHAT DAYSPRING FINDS IS IN BY DEFAULT.
 *
 * There used to be a third, `waiting`: found, dashed, and inert until the writer
 * pressed keep. On this archive that was 341 things to answer before the surface
 * did anything, which is a wall of homework standing where the value should be.
 * Recognition beats recall, and removing one wrong name is cheaper than
 * confirming three hundred right ones.
 *
 * The floor is what earns the default. Nothing is offered until it has recurred
 * across one page in a hundred, so "found" already means "you came back to this".
 *
 * `explicit` still wins over everything: a row the writer created is theirs, and
 * checking status first would relabel every typed subject as something the
 * machine found — the one claim this surface must never make.
 */
export function provenanceOf(item: ConcordanceItem, keptKeys: ReadonlySet<string>): Provenance {
  if (item.source === 'explicit' || item.source === 'correction') return 'mine'
  if (keptKeys.has(conKey(item.canonical))) return 'mine'
  return 'found'
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
  // The writer's own first, then what Dayspring found. Both are in; this only
  // decides which the eye meets first.
  const rank = (i: LifeMapItem) => (i.provenance === 'mine' ? 0 : 1)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  const at = a.firstSeen ?? ''
  const bt = b.firstSeen ?? ''
  if (at !== bt) return at < bt ? -1 : 1
  return a.label.localeCompare(b.label)
}

/**
 * A Concordance row the surface must not show at all — and `dormant` is NOT one.
 *
 * `DORMANT_AFTER_DAYS: 365` means "no new occurrence in a year". That is
 * RECENCY, not retirement, and on a fifteen-year archive it is 4,517 of 5,570
 * rows — most of the people in it. Hiding them would delete the writer's own
 * history from a surface whose whole job is holding it, and it would silently
 * break the one director move that depends on absence: "you wrote about your
 * father weekly for two years and not once since March."
 *
 * Dormant rows come through marked `dormant` so the surface can render them
 * quietly. Only `superseded` is genuinely gone — that row was replaced by
 * another and showing both would double the same subject.
 */
/**
 * ANYTHING THE WRITER ANSWERED IS ALWAYS CURRENT.
 *
 * Vera must never drift into "earlier" because she has not come up lately. That
 * is the app appearing to forget someone's wife, and a sort order making a claim
 * about a relationship. Eras organise the UNANSWERED OFFERS and nothing else.
 *
 * ⚠️ THE SCAN MUST NEVER SEE THIS. Filed is not forgotten: the vocabulary the
 * save-time matcher runs on is every answered subject, all eras, forever. If an
 * era ever filters that list, writing about your father after two years of
 * silence matches nothing — and the silence and return readings break at exactly
 * the moment they would be worth the most.
 */
export function eraOf(provenance: Provenance, dormant: boolean): Era {
  if (provenance === 'mine') return 'current'
  return dormant ? 'earlier' : 'current'
}

const retired = (item: ConcordanceItem) => item.status === 'superseded'

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
  floor = 3,
): LifeMapSection[] {
  const keptKeys = new Set(kept.map((k) => k.key))
  const items: LifeMapItem[] = []
  const seen = new Set<string>()

  for (const item of concordance) {
    if (retired(item)) continue
    if (isAddressee(item.canonical)) continue
    const key = conKey(item.canonical)
    if (seen.has(key)) continue
    // ANYTHING THE WRITER ANSWERED IS EXEMPT FROM THE FLOOR. A name they kept
    // must never disappear because it stopped recurring — that would be the app
    // overruling them with arithmetic, which is the one thing it may never do.
    const answered = item.source === 'explicit' || item.source === 'correction' ||
      item.status === 'confirmed' || keptKeys.has(key)
    if (!answered && item.occurrence_count < floor) continue
    seen.add(key)
    const provenance = provenanceOf(item, keptKeys)
    const dormant = item.status === 'dormant'
    items.push({
      key,
      id: item.id,
      label: displayLabel(item.canonical, item.surface_forms),
      section: sectionFor(item.kind),
      provenance,
      pages: item.occurrence_count,
      dormant,
      era: eraOf(provenance, dormant),
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
      id: null,
      label: k.label,
      section: keptSection(k),
      provenance: 'mine',
      pages: 0,
      dormant: false,
      era: 'current',
      firstSeen: k.keptAt,
      lastSeen: null,
      terms: k.terms,
    })
  }

  return SECTIONS.map((s) => {
    const own = items.filter((i) => i.section === s.id).sort(order)
    const current = own.filter((i) => i.era === 'current')
    return {
      id: s.id,
      label: s.label,
      ask: s.ask,
      what: s.what,
      items: current,
      earlier: own.filter((i) => i.era === 'earlier'),
      found: current.filter((i) => i.provenance !== 'mine').length,
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
  const all = sections.flatMap((s) => [...s.items, ...s.earlier])
  return {
    mine: all.filter((i) => i.provenance === 'mine').length,
    found: all.filter((i) => i.provenance === 'found').length,
  }
}
