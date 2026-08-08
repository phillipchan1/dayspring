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
 * Ids carrying EVERY chosen subject.
 *
 * AND, not OR, and the same reasoning as the facets: "Naomi and Chicago" is a
 * question someone means, while "Naomi or Chicago" hands back a bigger pile
 * than they started with. Lighting a second word must narrow.
 */
export function matchSubjects(index: SubjectIndex, subjects: Subject[]): Set<string> | null {
  if (subjects.length === 0) return null
  let hit: Set<string> | null = null
  for (const subject of subjects) {
    const next = matchSubject(index, subject)
    if (hit === null) hit = next
    else {
      const narrowed = new Set<string>()
      for (const id of hit) if (next.has(id)) narrowed.add(id)
      hit = narrowed
    }
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
 * The suggested chips.
 *
 * Ordered by how often the writer returns to something, and capped — this is a
 * handful of ways in, not a taxonomy of a person's life. It must never grow into
 * a tag manager: the Concordance is a record of spelling, not a filing system.
 */
export async function suggestedSubjects(limit = 14): Promise<Subject[]> {
  const items = await listConcordance()
  return items
    .slice()
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, limit)
    .map(subjectFromItem)
}
