/**
 * What a page shows, and what happens when it does not fit.
 *
 * ── The bug this module exists to kill ──────────────────────────────────────
 *
 * In the app today a page at reading zoom is a fixed-height box that scrolls
 * inside itself:
 *
 *     .pg__leaf-cell .pg-leaf { block-size: 100%; overflow-y: auto }
 *
 * So a long day gets its own scrollbar, and you end up scrolling INSIDE a page
 * while the wall is also scrolling behind it. Two nested scrollers with no
 * boundary between them is the thing that reads as wrong: on paper a page has
 * no scrollbar, because a page that runs out simply continues onto the next
 * one.
 *
 * ── The fix ─────────────────────────────────────────────────────────────────
 *
 * Nothing on this wall ever scrolls except the wall.
 *
 *   · A CARD is a page's FACE. Fixed aspect, clipped, with as many lines as
 *     fit and a fade where it stops. It is not a viewport into the page — you
 *     cannot scroll it, because a thumbnail you can scroll is not a thumbnail.
 *   · A LEAF at reading zoom CONTINUES. A day too long for one leaf occupies
 *     two, side by side, the way a book does it. The date is printed on the
 *     first leaf only, and that absence is the entire continuation cue: a leaf
 *     with no date is obviously the back half of the one before it.
 *
 * ── What it costs, named ────────────────────────────────────────────────────
 *
 * PageWall's uniform row height is what lets a 3,500-page archive window
 * cleanly, and continuation spends some of it: a page now occupies a variable
 * NUMBER of fixed-size leaves, so the grid stays uniform but the mapping from
 * entry to cell is no longer one-to-one. That is the honest trade, and it is
 * cheap at reading zoom specifically, where only two columns are on screen and
 * virtualization is barely earning its keep anyway.
 *
 * Line counts here are ESTIMATED from character counts rather than measured in
 * the DOM. That is a prototype shortcut and a real one — the app version has to
 * measure, or a page will occasionally break one line early.
 */

import type { Entry, Marking } from './corpus'

/** A line of her prose, and what she did to it. */
export type Face = {
  text: string
  /** She set this apart — marked, highlighted, underlined, quoted. Never inferred. */
  set: boolean
  /** Why this page lit up: a literal term, or the nearest line. */
  lit: boolean
}

export type PageFace = {
  lines: Face[]
  /** Prose lines in the WHOLE entry, so a card knows it stopped short. */
  total: number
  /** Characters in the whole entry — how full the day reads. */
  chars: number
}

/** Roughly how many rendered lines a paragraph takes at a given column width. */
function linesFor(text: string, cols: number): number {
  return Math.max(1, Math.ceil(text.length / cols))
}

const isSet = (m: Marking): boolean =>
  m.kind === 'mark' || m.kind === 'highlight' || m.kind === 'underline' || m.kind === 'quote'

/**
 * The face of a page.
 *
 * `litPara` is the paragraph that explains why this page came back — the one
 * carrying a typed word, or the one a semantic hit named. When a page lit
 * because of a line that is not in the first few paragraphs, that line is
 * PULLED FORWARD onto the face, because a card that lights up and then shows
 * you four paragraphs about something else has not shown its work.
 */
export function faceOf(
  entry: Entry,
  { maxLines, litPara }: { maxLines: number; litPara?: number | null },
): PageFace {
  const marked = new Set((entry.markings ?? []).filter(isSet).map((m) => m.para))
  const chars = entry.paragraphs.reduce((n, p) => n + p.length, 0)

  const order = entry.paragraphs.map((text, i) => ({ text, i }))
  if (litPara != null && litPara > 0 && litPara < order.length) {
    const [pulled] = order.splice(litPara, 1)
    if (pulled) order.unshift(pulled)
  }

  const lines = order.slice(0, Math.max(1, maxLines)).map(({ text, i }) => ({
    text,
    set: marked.has(i),
    lit: litPara != null && i === litPara,
  }))

  return { lines, total: entry.paragraphs.length, chars }
}

/**
 * How full the page looks, 0–1.
 *
 * Length as shape — a three-line day and a six-page day differ before you read
 * a word, the way they do in a notebook. A curve rather than a ratio, and with
 * no track behind it: there is nothing to be full AGAINST, so there is no
 * number here to score.
 */
export function fillOf(chars: number): number {
  return Math.min(1, Math.sqrt(chars / 2600))
}

export type Leaf = {
  entry: Entry
  /** Paragraph indices on this leaf. */
  paras: number[]
  /** 0 for the first leaf of a page, 1 for the continuation, and so on. */
  part: number
  /** More of this page follows on the next leaf. */
  continues: boolean
}

/**
 * A page laid out across as many leaves as it needs.
 *
 * A paragraph is never split across leaves — half a sentence on each side of a
 * gutter is worse than a short leaf, and paragraphs here are one thought each.
 * A single paragraph longer than a whole leaf gets its own leaf and overflows
 * it; that is rare, and clipping one paragraph is better than reintroducing a
 * scrollbar to handle it.
 */
export function leavesOf(entry: Entry, { rows, cols }: { rows: number; cols: number }): Leaf[] {
  const out: Leaf[] = []
  let paras: number[] = []
  let used = 0

  entry.paragraphs.forEach((text, i) => {
    const need = linesFor(text, cols) + 1 // + the blank line between paragraphs
    if (paras.length > 0 && used + need > rows) {
      out.push({ entry, paras, part: out.length, continues: true })
      paras = []
      used = 0
    }
    paras.push(i)
    used += need
  })

  out.push({ entry, paras, part: out.length, continues: false })
  return out
}

/** Every leaf on the wall, in date order. This is what the grid renders. */
export function leavesFor(entries: Entry[], spec: { rows: number; cols: number }): Leaf[] {
  return entries.flatMap((e) => leavesOf(e, spec))
}

/**
 * The same page, the way it behaves today — one cell, scrolled internally.
 *
 * Kept so `#wall` can put the current behaviour on screen beside the fix. Half
 * of that scene's job is to be beaten by it, and a comparison you have to
 * remember is not a comparison.
 */
export function singleLeaf(entries: Entry[]): Leaf[] {
  return entries.map((entry, part) => ({
    entry,
    paras: entry.paragraphs.map((_, i) => i),
    part,
    continues: false,
  }))
}
