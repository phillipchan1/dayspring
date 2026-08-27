// Subject lighting — the wall as its own density map.
//
// Pick a word, a person, a theme, and the pages that carry it stay lit while the
// rest fall away. Eleven years of pages with the ones about one thing glowing IS
// the density picture, and it is made of the actual pages, so it is grounded by
// construction: there is no cell to trust, only your own writing, dimmer or not.
//
// The matching is literal. A page lights up because the words are in it, never
// because a model thought the page was "about" something — that judgment is one
// we don't get to make (Principle 4, D-016). The Concordance only widens the net
// to the spellings and nicknames the writer actually uses.

import { listConcordance, type ConcordanceItem, type ConcordanceKind } from '@/lib/concordance'
import { entryContentLines } from '@/lib/entryLabels'
import type { Entry } from '@/lib/types'

export interface Subject {
  /** Stable identity — what history stores. */
  key: string
  label: string
  /** Every spelling that counts as a hit. */
  terms: string[]
  kind: ConcordanceKind | 'word'
  /**
   * Pages this lights. Filled by `withCounts` from the corpus, never read from
   * the Concordance — see the note there. Absent until something counts it.
   */
  count?: number
  /** When it first appeared in the journal. What the offered list orders by. */
  firstSeen?: string | null
}

/** One entry, flattened and lowercased once so re-lighting costs nothing. */
export interface SubjectIndex {
  ids: string[]
  haystacks: string[]
}

/**
 * Index the corpus for matching.
 *
 * Built over `entryContentLines`, not the raw markdown: a `/scripture` block's
 * verse text is the Bible's words, not the writer's, and lighting a page because
 * a quoted psalm says "fear" would misreport what they wrote about.
 */
export function buildSubjectIndex(entries: Entry[]): SubjectIndex {
  const ids: string[] = []
  const haystacks: string[] = []
  for (const e of entries) {
    ids.push(e.id)
    haystacks.push(entryContentLines(e.body_markdown).join('\n').toLowerCase())
  }
  return { ids, haystacks }
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whole words only.
 *
 * Substring matching lights "Ben" inside "benefit" and "bent", which on a wall of
 * eleven years reads as noise rather than a subject.
 */
function termRegex(terms: string[]): RegExp | null {
  const parts = terms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .map(escape)
  if (parts.length === 0) return null
  return new RegExp(`(^|[^a-z0-9])(${parts.join('|')})([^a-z0-9]|$)`, 'i')
}

/** Ids of every entry that carries the subject. */
export function matchSubject(index: SubjectIndex, subject: Subject): Set<string> {
  const re = termRegex(subject.terms)
  const hit = new Set<string>()
  if (!re) return hit
  for (let i = 0; i < index.ids.length; i++) {
    if (re.test(index.haystacks[i]!)) hit.add(index.ids[i]!)
  }
  return hit
}

/**
 * Ids carrying ANY chosen subject.
 *
 * SUBJECTS UNION; MARKINGS INTERSECT. That split is not arbitrary — it is what
 * the words mean when you say them out loud. "Mom and David" means pages about
 * EITHER, because you are naming the people you want to read about. "Mom and
 * prayers" means the prayers, because the second word narrows the first.
 *
 * This was AND, on the reasoning that lighting a second thing must narrow. It
 * is wrong for people specifically: intersecting two subjects on a real archive
 * returns almost nothing, and an empty screen reads as broken rather than as
 * accurate. What two subjects buy you instead is one band each against the same
 * months — where they overlap is visible without anybody computing an overlap.
 *
 * The narrowing still exists; it lives in the markings, which intersect (see
 * `matchFacets`), and in the two legs being intersected against each other.
 */
export function matchSubjects(index: SubjectIndex, subjects: Subject[]): Set<string> | null {
  if (subjects.length === 0) return null
  const hit = new Set<string>()
  for (const subject of subjects) {
    for (const id of matchSubject(index, subject)) hit.add(id)
  }
  return hit
}

/**
 * A matcher for painting the words themselves, not just the pages.
 *
 * Global and case-insensitive, with the same whole-word boundaries the page
 * matching uses — so what lights up inside a card is exactly what made the card
 * light up.
 */
export function subjectMatcher(subjects: Subject[]): RegExp | null {
  const terms = subjects.flatMap((s) => s.terms)
  if (terms.length === 0) return null
  const parts = terms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .map(escape)
  if (parts.length === 0) return null
  return new RegExp(`(?<![a-z0-9])(${parts.join('|')})(?![a-z0-9])`, 'gi')
}

/** Parse the history key list back into subjects. */
export function subjectsFromKeys(keys: string, suggested: Subject[]): Subject[] {
  if (!keys) return []
  const out: Subject[] = []
  for (const key of keys.split('\u0000')) {
    if (!key) continue
    if (key.startsWith('word:')) {
      const w = wordSubject(key.slice(5))
      if (w) out.push(w)
    } else {
      const found = suggested.find((s) => s.key === key)
      if (found) out.push(found)
    }
  }
  return out
}

/**
 * Serialise for history.
 *
 * NUL-joined rather than comma- or plus-joined: a typed word can contain any
 * punctuation a person can type, and a separator that appears inside a subject
 * silently splits it in two on reload.
 */
export function keysFromSubjects(subjects: Subject[]): string | null {
  if (subjects.length === 0) return null
  return subjects.map((s) => s.key).join('\u0000')
}

/**
 * A typed word becomes a subject with exactly one spelling — its own.
 *
 * The key keeps the writer's capitalisation. Matching is case-insensitive
 * regardless, and the label is rebuilt from the key on reload, so lowercasing it
 * here handed "Martha" back to them as "martha".
 */
export function wordSubject(raw: string): Subject | null {
  const word = raw.trim()
  if (word.length < 2) return null
  return { key: `word:${word}`, label: word, terms: [word], kind: 'word' }
}

export function subjectFromItem(item: ConcordanceItem): Subject {
  const terms = [item.canonical, ...(item.surface_forms ?? [])].filter(Boolean)
  return {
    key: `c:${item.id}`,
    label: item.canonical,
    terms: terms.length > 0 ? terms : [item.canonical],
    kind: item.kind,
  }
}

/**
 * The spelling to PRINT on a pill.
 *
 * The Concordance's canonical is whatever the extractor settled on, and on a
 * real archive that is sometimes "esther" or "CHristian" — matching doesn't
 * care, but a pill does, because the pill is the writer's own name for someone
 * handed back to them. So: prefer a spelling the writer actually used that
 * starts with a capital; failing that, repair the first letter only.
 *
 * Deliberately narrow. "SF", "IHOP" and "ESV" are how those are written and
 * title-casing them would be the defect, so the interior-capital repair fires
 * on exactly one shape — two leading capitals followed by lowercase.
 */
export function displayLabel(canonical: string, surfaceForms: string[] = []): string {
  const shouted = /^([A-Z])([A-Z])([a-z]{2,}.*)$/.exec(canonical)
  if (shouted) return `${shouted[1]}${shouted[2]!.toLowerCase()}${shouted[3]}`
  if (/^[A-Z]/.test(canonical)) return canonical
  const written = surfaceForms.find((f) => /^[A-Z]/.test(f) && f.toLowerCase() === canonical.toLowerCase())
  if (written) return written
  return canonical.charAt(0).toUpperCase() + canonical.slice(1)
}

/**
 * The One the journal is addressed to is not one of its subjects.
 *
 * On a fifteen-year Christian archive "Jesus" lights 2,914 pages of 3,571 and
 * "Holy Spirit" 2,832. Lighting them dims nothing, which means they are not a
 * way of looking at anything — they are the water the whole journal swims in.
 * Offering them as subjects is the surface failing to know what it is holding.
 *
 * This is NOT the stop list the prototype warned about. That warning was about
 * guessing which of someone's ORDINARY WORDS are the real ones — *down, also,
 * used, already* — a judgement no one gets to make on another person's
 * vocabulary. This is one fact about this product: it is a journal for
 * practising Christians, and the addressee of a prayer is not a topic in it.
 *
 * Deliberately conservative. "Father" is not here, because on a real archive it
 * is a person's actual father at least as often; the same goes for anything a
 * writer might plausibly be naming rather than addressing. And nothing here is
 * censored — typing "Jesus" into the field still lights every page that says
 * it, because that is the writer supplying the signal, which always wins.
 */
const ADDRESSEE = new Set([
  'god',
  'jesus',
  'jesus christ',
  'christ',
  'lord',
  'lord jesus',
  'the lord',
  'holy spirit',
  'the holy spirit',
  'spirit',
  'yahweh',
  'jehovah',
  'abba',
])

export const isAddressee = (label: string): boolean =>
  ADDRESSEE.has(label.trim().toLowerCase())

/**
 * One name, one subject — whatever the extractor filed it under.
 *
 * On a real archive 52 names live under two or more kinds: "David" as both
 * person and term, "Frontier" as org, place and project. Two pills that light
 * exactly the same pages is a defect the surface cannot fix from the outside,
 * because keeping has no merge gesture and never will (that is the tag manager
 * `SURFACES.md` forbids). So the merge happens here, in code.
 *
 * It is also safe by construction: matching is literal and case-insensitive, so
 * two rows sharing a canonical already light the same pages. Merging changes
 * what is SHOWN, never what matches.
 */
export function mergeItems(items: ConcordanceItem[]): Subject[] {
  const groups = new Map<string, ConcordanceItem[]>()
  for (const item of items) {
    const key = item.canonical.trim().toLowerCase()
    if (!key || isAddressee(key)) continue
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  /*
   * NO SUBJECT MAY CLAIM ANOTHER SUBJECT'S NAME.
   *
   * The extractor sometimes files one subject's name as another's alternate
   * spelling. On a real archive that is 19 cases, and two of them are severe:
   * "Chicago" carries "church" as a surface form, so choosing Chicago lights
   * every page that mentions church; "Esther" carries "judy", so a wife's
   * subject silently swallows a different person's pages. Nothing on screen
   * says this is happening — the wall simply lights the wrong pages, which is
   * the one failure this surface cannot afford.
   *
   * Nothing is lost by dropping them: the claimed name is itself a subject, so
   * its pages stay reachable under their own pill. Real abbreviations behave
   * the same way — dropping "sce" from "socal Edison" leaves SCE as its own
   * subject rather than folding two pills into one.
   */
  const canonicals = new Set(groups.keys())

  const out: Subject[] = []
  for (const [key, rows] of groups) {
    const forms = [
      ...new Set(rows.flatMap((r) => [r.canonical, ...(r.surface_forms ?? [])]).filter(Boolean)),
    ].filter((f) => {
      const lower = f.trim().toLowerCase()
      return lower === key || !canonicals.has(lower)
    })
    // The kind is only a grouping hint, so the one the extractor saw most often
    // wins. Nothing downstream matches on it.
    const dominant = rows.slice().sort((a, b) => b.occurrence_count - a.occurrence_count)[0]!
    const first = rows
      .map((r) => r.first_seen)
      .filter((d): d is string => Boolean(d))
      .sort()[0]
    out.push({
      // Keyed by the NAME, not by a row id: the row a name resolves to changes
      // every time the Concordance rebuilds, and a kept subject must survive that.
      key: `c:${key}`,
      label: displayLabel(dominant.canonical, forms),
      terms: forms.length > 0 ? forms : [dominant.canonical],
      kind: dominant.kind,
      firstSeen: first ?? null,
    })
  }
  return out
}

/**
 * Fill in each subject's page count from the corpus itself.
 *
 * NOT from `occurrence_count`. That column records what the extraction model
 * noticed while reading, and on the real archive it disagrees with a literal
 * re-count on 123 of the 124 subjects above five pages — "Jesus" stored at
 * 1,002 against 2,914 pages that actually light. Printing the stored number
 * beside a wall lit by the literal one is the surface contradicting itself in
 * a single glance, and of the two, the honest number is the one you can see:
 * the count of pages this lights (D-019 — code decides what matches, always).
 */
export function withCounts(index: SubjectIndex, subjects: Subject[]): Subject[] {
  return subjects.map((s) => ({ ...s, count: matchSubject(index, s).size }))
}

/**
 * Everything the writer returns to.
 *
 * All of it, not a handful. Five chips read as "here are your five subjects",
 * which is both wrong and constraining — this is a vocabulary, and the filter
 * field searches it. The Concordance is still a record of spelling rather than a
 * filing system: nothing here is a tag anyone has to maintain.
 *
 * Ordered by first appearance. Never by count: a list of the people in someone's
 * life sorted by how often they come up is a ranking of what they carry, and a
 * ranking is a verdict rendered in a sort.
 */
export async function allSubjects(): Promise<Subject[]> {
  return byFirstAppearance(mergeItems(await listConcordance()))
}

/** Oldest first, with anything undated last — a stable order with no ranking in it. */
function byFirstAppearance(subjects: Subject[]): Subject[] {
  return subjects.slice().sort((a, b) => {
    if (a.firstSeen && b.firstSeen) return a.firstSeen.localeCompare(b.firstSeen)
    if (a.firstSeen) return -1
    if (b.firstSeen) return 1
    return a.label.localeCompare(b.label)
  })
}

/** Rank a vocabulary against what has been typed so far. */
export function searchSubjects(all: Subject[], query: string, limit = 8): Subject[] {
  const q = query.trim().toLowerCase()
  if (!q) return all.slice(0, limit)
  const scored: { s: Subject; rank: number }[] = []
  for (const s of all) {
    // A prefix match on any spelling the writer uses beats a match buried
    // mid-word — "ela" should offer Elena before "Michaela".
    let rank = -1
    for (const t of [s.label, ...s.terms]) {
      const at = t.toLowerCase().indexOf(q)
      if (at === 0) rank = Math.max(rank, 2)
      else if (at > 0) rank = Math.max(rank, 1)
    }
    if (rank > 0) scored.push({ s, rank })
  }
  // Ties break on first appearance, not on size. `all` already arrives in that
  // order, so a stable sort on rank alone preserves it — and the list never
  // quietly becomes a ranking of the people in someone's life.
  return scored
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((x) => x.s)
}

/**
 * The suggested chips — a handful of ways in, not a taxonomy of a person's life.
 *
 * The cap is the only thing shortening this list, and it takes the EARLIEST
 * subjects rather than the biggest ones. Slicing the top by count would put a
 * ranking of someone's people on screen and call it a suggestion; taking the
 * oldest is arithmetic with nothing to read into it.
 */
export async function suggestedSubjects(limit = 14): Promise<Subject[]> {
  return (await allSubjects()).slice(0, limit)
}
