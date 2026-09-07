// What a page carries, besides its words.
//
// Every facet here is something the WRITER did — a sentence they highlighted, a
// line they underlined, a verse they cited, a passage they marked. Nothing is
// inferred, nothing is scored, and no model is involved at any point: a page
// carries a facet because the characters are in it (Principle 4, D-016).
//
// Built in one pass over the corpus and cached, because it is read on every
// re-light and the corpus is the whole archive.

import { NAMED_COLOR_PATTERN, type HighlightColor } from '@/lib/highlightColors'
import { LIVE_MARK_KINDS } from '@/lib/markKinds'
import type { MarkingRef } from '@/lib/spiritual'
import { entryContentLines, asEntryMarkdown } from '@/lib/entryLabels'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { practiceNameFromLine } from '@/lib/practiceTokens'
import { parseReferences } from '@/lib/scripture/parse'
import type { Entry, SpiritualItemType } from '@/lib/types'

/**
 * A facet key.
 *
 * Colours are `highlight:rose` and books are `book:Ps`, so one flat string key
 * covers both the coarse facets and their refinements and the wall never needs
 * to know which kind it is holding.
 */
export type FacetKey = string

export const FACET_MARK = 'mark'
export const FACET_HIGHLIGHT = 'highlight'
export const FACET_UNDERLINE = 'underline'
export const FACET_BOLD = 'bold'
export const FACET_QUOTE = 'quote'
export const FACET_SCRIPTURE = 'scripture'
export const FACET_PRAYER = 'prayer'
export const FACET_SENSE = 'sense'
export const FACET_RITUAL = 'ritual'

/**
 * The two families a facet belongs to.
 *
 * "Marked" is what the writer did TO a page after writing it; "Wrote" is what
 * they deliberately put ON it. Eleven flat chips in a row was a row nobody
 * could scan — grouping them is what makes the bar readable without making it
 * a filter panel.
 */
export type FacetGroup = 'marked' | 'wrote'

export const highlightFacet = (c: HighlightColor): FacetKey => `highlight:${c}`
export const bookFacet = (osis: string): FacetKey => `book:${osis}`

export interface FacetIndex {
  /** Facets carried, by entry id. */
  byEntry: Map<string, Set<FacetKey>>
  /** How many pages carry each facet — a chip nobody can use is not shown. */
  counts: Map<FacetKey, number>
}

/**
 * An amber highlight is a bare `==text==`; every other colour carries its name
 * in the opening marker. Both shapes have to be recognised, and `x == y` in
 * ordinary prose must not be, which is why this is a pair matcher rather than a
 * search for `==`.
 */
const HIGHLIGHT_RE = new RegExp(
  `==(?:\\{(${NAMED_COLOR_PATTERN})\\})?(?!\\s)([^=]+?)==`,
  'g',
)
const UNDERLINE_RE = /\+\+(?!\s)([^+]+?)(?<!\s)\+\+/
const BOLD_RE = /(\*\*|__)(?!\s)([\s\S]+?)(?<!\s)\1/

function add(set: Set<FacetKey>, counts: Map<FacetKey, number>, key: FacetKey): void {
  if (set.has(key)) return
  set.add(key)
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/**
 * Everything ONE page carries, from the document alone.
 *
 * Split out of `buildFacetIndex` so it can be cached per entry (see
 * `derived.ts`). This is the expensive half — a scripture parse, four regex
 * passes and a fence parse per page — and it depends on nothing but the
 * entry's own markdown, which means a corpus that gained one page does not
 * have to re-derive the other three thousand.
 *
 * Scripture is parsed here rather than read from `scripture_refs`, deliberately:
 * that table is behind the network, and the wall's whole contract is that it
 * works on a plane. `parseReferences` is the same parser save-time capture uses,
 * so the two agree.
 */
export function documentFacets(entry: Entry): FacetKey[] {
  const out: FacetKey[] = []
  const seen = new Set<FacetKey>()
  const put = (key: FacetKey) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push(key)
  }

  // Content lines only: a `/scripture` block's verse text is the Bible's
  // words, and a page must not count as "you cited Psalms" because a psalm
  // you pasted happens to quote one.
  const lines = entryContentLines(entry.body_markdown)
  const body = lines.join('\n')

  HIGHLIGHT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HIGHLIGHT_RE.exec(body))) {
    put(FACET_HIGHLIGHT)
    put(highlightFacet((m[1] as HighlightColor) ?? 'amber'))
  }

  if (UNDERLINE_RE.test(body)) put(FACET_UNDERLINE)
  if (BOLD_RE.test(body)) put(FACET_BOLD)
  if (lines.some((l) => l.trimStart().startsWith('>'))) put(FACET_QUOTE)

  for (const ref of parseReferences(body)) {
    put(FACET_SCRIPTURE)
    put(bookFacet(ref.book_osis))
  }

  /*
   * What the writer deliberately put on the page.
   *
   * Read from the RAW markdown, not the content lines — `entryContentLines`
   * strips these fences before anything else sees them, which is exactly
   * right for prose and exactly wrong here.
   *
   * A `/scripture` block also counts as scripture: citing a verse by typing
   * it and citing it with the command are the same act to the person who did
   * it, whatever the storage says.
   */
  const raw = asEntryMarkdown(entry.body_markdown)
  for (const block of parseSpiritualBlocks(raw)) {
    if (block.type === 'prayer') put(FACET_PRAYER)
    else if (block.type === 'sense') put(FACET_SENSE)
    else if (block.type === 'scripture') put(FACET_SCRIPTURE)
  }
  for (const line of raw.split('\n')) {
    if (practiceNameFromLine(line.trim())) {
      put(FACET_RITUAL)
      break
    }
  }
  return out
}

/**
 * Index the corpus.
 *
 * `facetsFor` exists so the caller can hand in a cached derivation. The default
 * is the real thing, so every test and every call site that doesn't care gets
 * correct behaviour for free; `derived.ts` passes a per-entry memo so that
 * re-entering Pages costs assembly rather than re-derivation.
 */
export function buildFacetIndex(
  entries: Entry[],
  markedEntryIds: Iterable<string> = [],
  markings: Iterable<MarkingRef> = [],
  facetsFor: (entry: Entry) => readonly FacetKey[] = documentFacets,
): FacetIndex {
  const byEntry = new Map<string, Set<FacetKey>>()
  const counts = new Map<FacetKey, number>()

  for (const entry of entries) {
    const set = new Set<FacetKey>()
    byEntry.set(entry.id, set)
    for (const key of facetsFor(entry)) add(set, counts, key)
  }

  for (const id of markedEntryIds) {
    const set = byEntry.get(id)
    if (set) add(set, counts, FACET_MARK)
  }

  /*
   * The markings that live in `spiritual_items` rather than in the document.
   *
   * A page acquires a marking two ways, and both are real. The writer types
   * `/pray` and the fence goes into the markdown; or the journal reads a page
   * already written and lays the prayer that is plainly in it onto the Altar —
   * the writer's own verbatim sentence, selected by a model, dated to the page.
   *
   * Reading only the fences was the defect: on a fifteen-year archive imported
   * from another journal that is 7 pages with a prayer on them instead of 2,361,
   * because the markings are a Dayspring gesture and the pages predate it. Both
   * sources land on the SAME facet — one pill per kind, not two — so choosing
   * "Prayer" means every page carrying one, however it got there.
   */
  for (const m of markings) {
    const set = byEntry.get(m.entryId)
    if (set) add(set, counts, m.type)
  }

  return { byEntry, counts }
}

/**
 * Pages carrying EVERY chosen facet.
 *
 * AND, not OR. "Highlighted and mentions Psalms" is a question someone means;
 * "highlighted or mentions Psalms" is a bigger pile than they started with.
 */
export function matchFacets(index: FacetIndex, keys: FacetKey[]): Set<string> | null {
  if (keys.length === 0) return null
  const hit = new Set<string>()
  for (const [id, set] of index.byEntry) {
    if (keys.every((k) => set.has(k))) hit.add(id)
  }
  return hit
}

export interface FacetChip {
  key: FacetKey
  label: string
  /** Pages carrying it — shown so a choice is never a shot in the dark. */
  count: number
  /** Highlight colours render as a swatch rather than a word. */
  color?: HighlightColor
}

export interface FacetGrouping {
  group: FacetGroup
  label: string
  chips: FacetChip[]
}

export interface MarkingChip extends FacetChip {
  kind: SpiritualItemType
  /** CSS custom property carrying the kind's hue. */
  tone: string
}

/**
 * The declared kinds, as pills — the six, in their own order.
 *
 * A kind carrying no pages is KEPT and dimmed rather than dropped. The set is
 * closed and the same every time; a list that silently changes length teaches
 * the reader that the vocabulary is variable, which is the beginning of a tag
 * manager. Dimming says "nothing here yet", which is true and is not a promise
 * about tomorrow.
 *
 * `LIVE_MARK_KINDS`, not `MARK_KINDS`: Gift and Absence were cut because a
 * writer read the labels and could not tell what they meant. Pages that already
 * carry them still draw them — the index is built over every kind — but nothing
 * retired is ever offered.
 */
export function markingChips(index: FacetIndex): MarkingChip[] {
  return LIVE_MARK_KINDS.map((k) => ({
    key: k.kind as FacetKey,
    kind: k.kind,
    label: k.label,
    tone: k.tone,
    count: index.counts.get(k.kind) ?? 0,
  }))
}
