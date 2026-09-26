// Finding something you wrote.
//
// Every subject on this surface is a NAME — a person, a place, a word the
// Concordance kept — and matched literally. That is right for lighting, and it
// left out the commonest reason anyone opens a find field in a journal: "I wrote
// something like this once." Typed into the field, "formative desert" became a
// one-spelling subject that matched only those two words side by side, filed
// under Matters with a 0 beside it — and a phrase half-remembered is almost
// never remembered in the order it was written.
//
// So a search is forgiving about the four things memory gets wrong, in this
// order, and says which one it forgave:
//
//   exact  the words, in that order, side by side
//   near   every word, close together, in any order or any form of the word
//   page   every word, somewhere on the same page
//   some   some of the words — offered only when nothing above exists
//
// ── Forgiving, and still grounded ───────────────────────────────────────────
//
// Nothing here is a model and nothing here guesses what a page is ABOUT
// (Principle 4, D-016). The forgiveness is spelling only: each word asked for is
// widened to the forms of it THE WRITER ACTUALLY USED — endings ("desert",
// "deserts"), related forms ("formative", "formation"), a slip of one letter,
// and the word still being typed — looked up in the archive's own vocabulary.
// Every page that lights has the words on it; every word painted is one she
// wrote. What changes is only which of her words count as the one asked for.
//
// ── Order ───────────────────────────────────────────────────────────────────
//
// Closeness first, because it is a fact about the words — then the wall's own
// order within each. Never by how much a page says the thing, which would be a
// ranking of her pages by relevance: selection is significance.

import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import type { Entry } from '@/lib/types'
import { splitOnMatch } from './pageExcerpt'
import { writerLines, type Subject, type SubjectIndex } from './subjects'

export type Closeness = 'exact' | 'near' | 'page' | 'some'

export interface Found {
  id: string
  closeness: Closeness
  /** How many of the words asked for are on the page. Only varies for `some`. */
  words: number
}

export interface PageSearch {
  /** As typed, trimmed. */
  query: string
  /** The words it was matched on — every word asked for, less the small ones. */
  words: string[]
  /** One list per word: every spelling in the archive that counts as it. */
  spellings: string[][]
  /** Every page, closest first and wall order within each. */
  found: Found[]
  /** How many pages carry every word — what "light these" lights. */
  lightable: number
  /** Paints the words inside a passage. Global; reset before use. */
  paint: RegExp | null
}

/**
 * Words too common to search BY — never words the writer is told not to use.
 *
 * Only for the forgiving tiers. The exact phrase keeps every word, so "it is
 * well" still finds the page that says exactly that; but "the desert" needs a
 * page with "desert" near "the", and every page has "the" near everything.
 * Dropped only while something else is left to match on.
 */
const SMALL = new Set(
  (
    'a an and are as at be but by did do for from had has have he her his i in ' +
    'is it its me my no not of on or our so that the their them then there they ' +
    'this to was we were what when with you your'
  ).split(' '),
)

const WORD = /[\p{L}\p{N}]+/gu

/** Lowercase, curly apostrophes straightened — how both sides are compared. */
const fold = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'")

export function tokens(text: string): string[] {
  return fold(text).match(WORD) ?? []
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The same boundaries `subjects.ts` matches on, so what a search finds and what
 * the wall then lights are the same pages.
 */
function anyOf(spellings: string[], flags = 'i'): RegExp | null {
  const parts = spellings.filter((t) => t.length >= 2).map(escape)
  if (parts.length === 0) return null
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})(?![\\p{L}\\p{N}])`, `${flags}u`)
}

/**
 * The words in that order, with anything that is not a letter between them —
 * so "formative, desert" and a line break between the two both still count as
 * what she typed.
 */
function phraseRegex(query: string): RegExp | null {
  const words = tokens(query)
  if (words.length === 0) return null
  const body = words.map(escape).join(`[^\\p{L}\\p{N}]+`)
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'iu')
}

// ── The vocabulary ───────────────────────────────────────────────────────────

/**
 * Crude on purpose. Two words are the same word here when they share what is
 * left after one common ending comes off — "prayer", "prayers", "praying" and
 * "prayed" all leave "pray". It will miss some pairs a linguist would join, and
 * the typo pass catches most of those; it must never join words that are not
 * related, which is why nothing shorter than three letters is left behind.
 */
const ENDINGS: [string, number][] = [
  ['ments', 3], ['ment', 3], ['ness', 3], ['ings', 3], ['ing', 3], ['ions', 3],
  ['ion', 3], ['ives', 3], ['ive', 3], ['ies', 3], ['ied', 3], ['ers', 3],
  ['er', 3], ['ed', 3], ['es', 3], ['ly', 3], ['s', 3], ['e', 3], ['y', 4],
]

export function stem(word: string): string {
  for (const [end, min] of ENDINGS) {
    if (word.endsWith(end) && word.length - end.length >= min) return word.slice(0, -end.length)
  }
  return word
}

interface Vocabulary {
  /** Every word in the archive, with the number of pages it is on. */
  pages: Map<string, number>
  /** Words by stem. */
  stems: Map<string, string[]>
}

const vocabularies = new WeakMap<SubjectIndex, Vocabulary>()

/**
 * Every word she has written, counted by page. Built once per index — the
 * index is rebuilt only when the archive changes — and never shown.
 */
export function vocabularyOf(index: SubjectIndex): Vocabulary {
  const held = vocabularies.get(index)
  if (held) return held
  const pages = new Map<string, number>()
  for (const hay of index.haystacks) {
    for (const w of new Set(tokens(hay))) {
      if (w.length >= 2) pages.set(w, (pages.get(w) ?? 0) + 1)
    }
  }
  const stems = new Map<string, string[]>()
  for (const w of pages.keys()) {
    const s = stem(w)
    const list = stems.get(s)
    if (list) list.push(w)
    else stems.set(s, [w])
  }
  const v = { pages, stems }
  vocabularies.set(index, v)
  return v
}

/** Edit distance, giving up as soon as it cannot come in under `max`. */
export function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let low = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost)
      row.push(v)
      if (v < low) low = v
    }
    if (low > max) return false
    prev = row
  }
  return prev[b.length]! <= max
}

/** How far a word can be misspelt and still be the same word. */
const slack = (word: string): number => (word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0)

/**
 * Past this, a word is matching too much of the archive to mean anything. Kept
 * by how many pages each spelling is on — a bound on what one word can drag in,
 * the same kind as `FOUND_WHEN_SEARCHING`, not a judgement of any page.
 */
const SPELLINGS_PER_WORD = 40

/**
 * Every spelling in the archive that counts as `word`.
 *
 * `typing` is the last word of a query still being typed, which also takes any
 * longer word it begins — so "formative des" is already finding "desert".
 */
export function spellingsOf(word: string, vocab: Vocabulary, typing = false): string[] {
  const out = new Set<string>([word])
  if (word.length >= 3) {
    for (const w of vocab.stems.get(stem(word)) ?? []) out.add(w)
  }
  const max = slack(word)
  const prefix = typing && word.length >= 3
  if (max > 0 || prefix) {
    for (const w of vocab.pages.keys()) {
      if (prefix && w.startsWith(word)) out.add(w)
      // Same first letter: a slip is almost never there, and without it
      // "grace" reaches "trace" and "place".
      else if (max > 0 && w[0] === word[0] && within(word, w, max)) out.add(w)
    }
  }
  const list = [...out]
  if (list.length <= SPELLINGS_PER_WORD) return list
  const rest = list
    .filter((w) => w !== word)
    .sort((a, b) => (vocab.pages.get(b) ?? 0) - (vocab.pages.get(a) ?? 0))
  return [word, ...rest.slice(0, SPELLINGS_PER_WORD - 1)]
}

// ── Searching ────────────────────────────────────────────────────────────────

/** How close "close together" is: a sentence or two either side. */
const nearFor = (words: number): number => Math.max(12, words * 5)

/** The smallest run of tokens holding one of each list, or Infinity. */
function span(toks: string[], sets: Set<string>[]): number {
  const k = sets.length
  const last = new Array<number>(k).fill(-1)
  let best = Infinity
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!
    let hit = false
    for (let g = 0; g < k; g++) {
      if (sets[g]!.has(t)) {
        last[g] = i
        hit = true
      }
    }
    if (!hit) continue
    let lo = Infinity
    for (const at of last) {
      if (at < 0) {
        lo = -1
        break
      }
      if (at < lo) lo = at
    }
    if (lo >= 0) best = Math.min(best, i - lo + 1)
  }
  return best
}

/**
 * Every page that says it, or something like it.
 *
 * `typing` should be true while the field has focus and the query does not end
 * in a space — the last word is then allowed to be unfinished.
 */
export function searchPages(index: SubjectIndex, raw: string, typing = false): PageSearch {
  const query = raw.trim()
  const asked = [...new Set(tokens(query))].filter((w) => w.length >= 2)
  const empty: PageSearch = { query, words: [], spellings: [], found: [], lightable: 0, paint: null }
  if (asked.length === 0) return empty

  const big = asked.filter((w) => !SMALL.has(w))
  const words = big.length > 0 ? big : asked
  const vocab = vocabularyOf(index)
  const lastAsked = tokens(query).at(-1)
  const spellings = words.map((w) => spellingsOf(w, vocab, typing && w === lastAsked))

  const phrase = phraseRegex(query)
  const lists = spellings.map((s) => anyOf(s))
  const sets = spellings.map((s) => new Set(s))
  const one = words.length === 1

  const exact: Found[] = []
  const near: Found[] = []
  const page: Found[] = []
  const some: Found[] = []
  for (let i = 0; i < index.ids.length; i++) {
    const hay = index.haystacks[i]!
    const id = index.ids[i]!
    let n = 0
    for (const re of lists) if (re?.test(hay)) n++
    if (n === 0) continue
    if (n < words.length) {
      if (!one && n * 2 >= words.length) some.push({ id, closeness: 'some', words: n })
      continue
    }
    if (phrase?.test(hay)) exact.push({ id, closeness: 'exact', words: n })
    else if (one || span(tokens(hay), sets) <= nearFor(words.length))
      near.push({ id, closeness: 'near', words: n })
    else page.push({ id, closeness: 'page', words: n })
  }

  const lightable = exact.length + near.length + page.length
  // Some of the words is a fallback, never a tier of its own: with two words it
  // is every page that says either, which buries the one you wanted.
  const tail = lightable > 0 ? [] : some.sort((a, b) => b.words - a.words)
  return {
    query,
    words,
    spellings,
    found: [...exact, ...near, ...page, ...tail],
    lightable,
    paint: anyOf([...new Set([...spellings.flat(), ...tokens(query)])], 'gi'),
  }
}

/** The history key for a search — rebuilt, not stored, on the way back. */
export const findKey = (query: string): string => `find:${query.trim()}`

/**
 * A search as something to light, so it goes on the wall like any subject.
 *
 * Lights the pages that carry every word — `exact`, `near` and `page` — and
 * paints every spelling that counted. Null when nothing would light.
 */
export function findSubject(index: SubjectIndex, query: string): Subject | null {
  const s = searchPages(index, query)
  if (s.words.length === 0) return null
  return {
    key: findKey(s.query),
    label: `“${s.query}”`,
    terms: [...new Set(s.spellings.flat())],
    every: s.spellings,
    kind: 'word',
  }
}

// ── The passage ──────────────────────────────────────────────────────────────

/** How much of a line a result shows. About two lines of the sheet. */
const PASSAGE = 170

/**
 * The line that says it, cut to fit, split into plain and matched runs (odd
 * indices matched — `splitOnMatch`'s contract).
 *
 * Verbatim. The line with the exact phrase if there is one, else the one
 * carrying the most of the words, and only ever trimmed at a word — never
 * reworded, never joined to a line she did not put beside it.
 */
export function passageFor(entry: Pick<Entry, 'body_markdown'>, search: PageSearch): string[] {
  const lines = writerLines(entry.body_markdown).map((l) => stripMarkdownMarkers(l).trim()).filter(Boolean)
  if (lines.length === 0) return ['']
  const phrase = phraseRegex(search.query)
  const lists = search.spellings.map((s) => anyOf(s))

  let best = lines[0]!
  let bestScore = -1
  for (const line of lines) {
    let score = phrase?.test(line) ? 100 : 0
    for (const re of lists) if (re?.test(line)) score++
    if (score > bestScore) {
      best = line
      bestScore = score
    }
  }

  let text = best
  if (text.length > PASSAGE) {
    const paint = search.paint
    if (paint) paint.lastIndex = 0
    const first = (phrase?.exec(text) ?? paint?.exec(text))?.index ?? 0
    let from = Math.max(0, first - Math.floor(PASSAGE / 3))
    if (from > 0) {
      const gap = text.indexOf(' ', from)
      from = gap >= 0 && gap < first ? gap + 1 : from
    }
    let to = Math.min(text.length, from + PASSAGE)
    if (to < text.length) {
      const gap = text.lastIndexOf(' ', to)
      if (gap > first) to = gap
    }
    text = `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
  }
  return splitOnMatch(text, search.paint)
}
