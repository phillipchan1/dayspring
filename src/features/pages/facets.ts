// What a page carries, besides its words.
//
// Every facet here is something the WRITER did — a sentence they highlighted, a
// line they underlined, a verse they cited, a passage they marked. Nothing is
// inferred, nothing is scored, and no model is involved at any point: a page
// carries a facet because the characters are in it (Principle 4, D-016).
//
// Built in one pass over the corpus and cached, because it is read on every
// re-light and the corpus is the whole archive.

import { HIGHLIGHT_ORDER, NAMED_COLOR_PATTERN, type HighlightColor } from '@/lib/highlightColors'
import { entryContentLines, asEntryMarkdown } from '@/lib/entryLabels'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { practiceNameFromLine } from '@/lib/practiceTokens'
import { parseReferences } from '@/lib/scripture/parse'
import type { Entry } from '@/lib/types'

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
  `==(?:\\{(${NAMED_COLOR_PATTERN})\\})?(?!\\s)([^=]+?)(?<!\\s)==`,
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
 * Index the corpus.
 *
 * Scripture is parsed here rather than read from `scripture_refs`, deliberately:
 * that table is behind the network, and the wall's whole contract is that it
 * works on a plane. `parseReferences` is the same parser save-time capture uses,
 * so the two agree.
 */
export function buildFacetIndex(
  entries: Entry[],
  markedEntryIds: Iterable<string> = [],
): FacetIndex {
  const byEntry = new Map<string, Set<FacetKey>>()
  const counts = new Map<FacetKey, number>()

  for (const entry of entries) {
    const set = new Set<FacetKey>()
    byEntry.set(entry.id, set)

    // Content lines only: a `/scripture` block's verse text is the Bible's
    // words, and a page must not count as "you cited Psalms" because a psalm
    // you pasted happens to quote one.
    const lines = entryContentLines(entry.body_markdown)
    const body = lines.join('\n')

    HIGHLIGHT_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = HIGHLIGHT_RE.exec(body))) {
      add(set, counts, FACET_HIGHLIGHT)
      add(set, counts, highlightFacet((m[1] as HighlightColor) ?? 'amber'))
    }

    if (UNDERLINE_RE.test(body)) add(set, counts, FACET_UNDERLINE)
    if (BOLD_RE.test(body)) add(set, counts, FACET_BOLD)
    if (lines.some((l) => l.trimStart().startsWith('>'))) add(set, counts, FACET_QUOTE)

    for (const ref of parseReferences(body)) {
      add(set, counts, FACET_SCRIPTURE)
      add(set, counts, bookFacet(ref.book_osis))
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
      if (block.type === 'prayer') add(set, counts, FACET_PRAYER)
      else if (block.type === 'sense') add(set, counts, FACET_SENSE)
      else if (block.type === 'scripture') add(set, counts, FACET_SCRIPTURE)
    }
    for (const line of raw.split('\n')) {
      if (practiceNameFromLine(line.trim())) {
        add(set, counts, FACET_RITUAL)
        break
      }
    }
  }

  for (const id of markedEntryIds) {
    const set = byEntry.get(id)
    if (set) add(set, counts, FACET_MARK)
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

/**
 * The chips worth offering, in two plain-English groups.
 *
 * Eleven of these in one row was a row nobody could scan, and it read as a
 * filter panel rather than as a way of looking. "Marked" is what you did to a
 * page; "Wrote" is what you put on it. Both are things the WRITER did — nothing
 * here is inferred (D-016).
 *
 * A facet no page carries is omitted rather than shown empty: an unusable
 * control that reports zero is a worse answer than no control. Counts are shown
 * for the same reason — choosing a filter should never be a shot in the dark.
 */
export function facetGroups(index: FacetIndex): FacetGrouping[] {
  const chip = (key: FacetKey, label: string, color?: HighlightColor): FacetChip | null => {
    const count = index.counts.get(key) ?? 0
    if (count === 0) return null
    return color ? { key, label, count, color } : { key, label, count }
  }
  const kept = (...xs: (FacetChip | null)[]): FacetChip[] => xs.filter((x): x is FacetChip => x !== null)

  const marked = kept(
    chip(FACET_MARK, 'Marked'),
    chip(FACET_HIGHLIGHT, 'Highlighted'),
    ...HIGHLIGHT_ORDER.map((c) => chip(highlightFacet(c), c, c)),
    chip(FACET_UNDERLINE, 'Underlined'),
    chip(FACET_BOLD, 'Emphasised'),
    chip(FACET_QUOTE, 'Quoted'),
  )
  const wrote = kept(
    chip(FACET_SCRIPTURE, 'Scripture'),
    chip(FACET_PRAYER, 'Prayer'),
    chip(FACET_SENSE, 'Sense'),
    chip(FACET_RITUAL, 'Ritual'),
  )

  const out: FacetGrouping[] = []
  if (marked.length > 0) out.push({ group: 'marked', label: 'Marked', chips: marked })
  if (wrote.length > 0) out.push({ group: 'wrote', label: 'Wrote', chips: wrote })
  return out
}
