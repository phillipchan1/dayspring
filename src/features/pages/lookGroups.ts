// `Look for`, in the Life Map's four lists.
//
// PAGES AND THE LIFE MAP ARE ALREADY ONE VOCABULARY. `PagesView` calls
// `allSubjects()` and `listKeptSubjects()`; the Life Map calls `buildLifeMap()`
// over the same two tables. There is no second list, there never was — but the
// sheet showed them as one flat run of pills, so nothing on screen said so, and
// a reader who had just named twelve people in the Life Map met them again here
// as an undifferentiated heap and reasonably concluded they had been asked for
// the same thing twice.
//
// So this module borrows the Life Map's own `SECTIONS` and `sectionFor` rather
// than restating four kinds beside them. If a fifth list is ever added there,
// this follows without anybody remembering to.

import { SECTIONS, sectionFor, type SectionId } from '@/features/lifemap/lifeMap'
import type { Subject } from './subjects'

export interface LookGroup {
  id: SectionId
  label: string
  /** What the writer answered — kept in the Life Map, or typed here. Never amber. */
  mine: Subject[]
  /** What the journal offered and nobody has answered. Amber, same as there. */
  found: Subject[]
}

/**
 * Which of the four a subject belongs to.
 *
 * THE WRITER'S OWN FILING WINS. `kept_subjects.kind` records the box they typed
 * a subject into on the Life Map, and it outranks the Concordance's guess about
 * the same word — the extractor files "Frontier" as an org, a place and a
 * project on the real archive, and the person who wrote it knows which.
 *
 * Everything unfiled falls to Matters rather than being dropped: a typed word
 * has no kind to read, and a row kept before `kind` existed has a null one. A
 * subject must never vanish from a list because a column arrived late.
 */
export function sectionOf(subject: Subject): SectionId {
  const own = subject.section
  if (own === 'person' || own === 'place' || own === 'domain' || own === 'matter') return own
  return subject.kind === 'word' ? 'matter' : sectionFor(subject.kind)
}

/**
 * The floor: how often something has to recur before the sheet offers it.
 *
 * A FLOOR IS FILTERING; "THE TOP THIRTY" WOULD BE RANKING, and ranking is a
 * verdict (D-016). The sheet used to take the first six noticed subjects, which
 * is a cap — honest about its arithmetic, but it left the other nine hundred
 * unreachable except by guessing at a name. The floor is `floorFor` from the
 * Life Map, ONE PAGE IN A HUNDRED, stated on screen and overruled by typing:
 * the find field still searches the whole vocabulary, floor or no floor.
 *
 * MEASURED, NOT COUNTED. `Subject.occurrences` is the Concordance's own stored
 * number, and it is the wrong number to PRINT (see `withCounts`) — but counting
 * nine hundred subjects against three thousand pages to decide which forty to
 * offer costs most of a second, and this only decides membership. The number
 * shown on a pill is still the literal one.
 *
 * A subject with no stored count passes. That is the honest default: an unknown
 * count is not evidence of absence, and silently dropping a name because a field
 * was missing is the failure this whole surface is built to avoid.
 */
export function aboveFloor(subjects: readonly Subject[], floor: number): Subject[] {
  return subjects.filter((s) => s.occurrences === undefined || s.occurrences >= floor)
}

/** A stretch of the calendar, half-open: `[start, end)`. From `spanBounds`. */
export interface Window {
  start: string
  end: string
}

/**
 * Was this subject alive in these months?
 *
 * THE STAGE THAT MAKES A BRACKETED SHEET AFFORDABLE. Bracket a winter and the
 * question stops being "does this recur across the archive" and becomes "does
 * this recur across THESE PAGES" — which only a literal re-count can answer, and
 * re-counting nine hundred subjects is most of a second even over a short
 * bracket. So the vocabulary is narrowed first by the two dates every
 * Concordance row already carries, which costs one comparison each and typically
 * takes nine hundred subjects to a couple of hundred.
 *
 * It is deliberately COARSE. A subject alive 2015–2020 passes for any month in
 * between, silent ones included; the literal count that follows is what actually
 * decides, and a subject with nothing in the bracket falls out there. Being
 * generous here and strict there is the right way round — the cheap stage must
 * never be the one that removes a name.
 *
 * A missing date passes, the same honest default as `aboveFloor`: an unknown is
 * not evidence of absence.
 */
export function aliveIn(subjects: readonly Subject[], window: Window): Subject[] {
  return subjects.filter(
    (s) =>
      (s.firstSeen == null || s.firstSeen < window.end) &&
      (s.lastSeen == null || s.lastSeen >= window.start),
  )
}

/**
 * Four groups, in the Life Map's order, with the empty ones dropped.
 *
 * NOTHING IS SORTED HERE. `mine` arrives in the order the writer kept things and
 * `found` in first-appearance order, and both are carried through untouched — a
 * list of the people in someone's life arranged by how often they come up is a
 * ranking of what they carry, and a ranking is a verdict rendered in a sort.
 *
 * Empty groups are dropped rather than shown as bare headings. Four labels with
 * nothing under three of them reads as a form waiting to be filled in; the
 * kinds present are the kinds the journal actually has.
 */
export function groupSubjects(
  mine: readonly Subject[],
  found: readonly Subject[],
): LookGroup[] {
  const groups = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    mine: [] as Subject[],
    found: [] as Subject[],
  }))
  const by = new Map(groups.map((g) => [g.id, g]))
  for (const s of mine) by.get(sectionOf(s))?.mine.push(s)
  for (const s of found) by.get(sectionOf(s))?.found.push(s)
  return groups.filter((g) => g.mine.length > 0 || g.found.length > 0)
}
