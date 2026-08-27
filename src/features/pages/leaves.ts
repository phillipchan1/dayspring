// How many leaves a page runs to.
//
// At reading zoom a long page currently scrolls INSIDE its own box, so you
// scroll within a page while the wall scrolls behind it — two scrollers, and
// the inner one turns a page into a viewport. A page in a book does not do
// that: it fills, and the rest continues on the next leaf.
//
// ── Why this has to measure, and cannot estimate ────────────────────────────
//
// The prototype divides character counts by a guess at characters-per-line,
// and names it as a cheat: "the real version must measure, or a page
// occasionally breaks one line early." A page that breaks one line early is a
// sentence cut in half for no reason the reader can see.
//
// So this measures, with a canvas: the same text metrics the browser uses to
// lay the paragraph out, without laying anything out. It is O(characters) and
// cached, which is what makes it affordable across a 3,580-page archive where
// the windowing needs every count up front to size the scroller.

import { entryContentLines } from '@/lib/entryLabels'
import type { Entry } from '@/lib/types'

export interface LeafMetrics {
  /** Content width of a leaf, in CSS pixels. */
  width: number
  /** Prose lines a leaf has room for. */
  linesPerLeaf: number
  /** The face the leaf body is set in, as a CSS `font` shorthand. */
  font: string
}

/** One leaf of one page. Uniform height, which is what keeps windowing honest. */
export interface LeafRef {
  entry: Entry
  /** 0 for the first leaf of a page. */
  index: number
  /** How many leaves this page runs to. */
  of: number
}

let canvas: HTMLCanvasElement | null = null
function context(font: string): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.font = font
  return ctx
}

/**
 * Word widths, remembered.
 *
 * `measureText` is the whole cost here, and a personal journal is enormously
 * repetitive — fifteen years of it runs to something like a million tokens
 * drawn from a few tens of thousands of distinct words. Measuring "the" once
 * instead of forty thousand times is the difference between a second of
 * blocked main thread and none.
 *
 * Keyed by font as well as word, because the same word is a different width in
 * a different face, and the cache outlives a theme change.
 */
const widths = new Map<string, number>()

function widthOf(ctx: CanvasRenderingContext2D, word: string, font: string): number {
  const key = `${font}\u0000${word}`
  const held = widths.get(key)
  if (held !== undefined) return held
  const w = ctx.measureText(word).width
  widths.set(key, w)
  return w
}

/**
 * How many rendered lines one paragraph takes at this width.
 *
 * Greedy wrapping on whitespace, which is what a browser does for ordinary
 * prose. It is not a full line-breaking implementation — no hyphenation, no
 * `text-wrap: pretty` — and does not need to be: a paragraph that measures one
 * line long when the browser gives it two costs a leaf break in the wrong
 * place roughly never, where a character-count estimate is wrong constantly.
 */
export function linesForParagraph(text: string, width: number, font: string): number {
  const ctx = context(font)
  const trimmed = text.trim()
  if (!trimmed) return 1
  // No canvas (server render, jsdom): fall back to something stable rather than
  // throwing. The count is refined the moment it runs in a browser.
  if (!ctx || width <= 0) return Math.max(1, Math.ceil(trimmed.length / 80))

  let lines = 1
  let used = 0
  const space = widthOf(ctx, ' ', font)
  for (const word of trimmed.split(/\s+/)) {
    const w = widthOf(ctx, word, font)
    if (used === 0) {
      used = w
      continue
    }
    if (used + space + w <= width) {
      used += space + w
    } else {
      lines += 1
      used = w
    }
  }
  return lines
}

/**
 * Leaves for one page.
 *
 * A blank line between paragraphs costs a line, because it does on the page —
 * counting only the prose puts the break a line late on anything with more
 * than one paragraph.
 */
export function leavesForEntry(entry: Entry, m: LeafMetrics): number {
  const paragraphs = entryContentLines(entry.body_markdown)
  if (paragraphs.length === 0) return 1
  let lines = 0
  for (let i = 0; i < paragraphs.length; i++) {
    if (i > 0) lines += 1
    lines += linesForParagraph(paragraphs[i]!, m.width, m.font)
  }
  return Math.max(1, Math.ceil(lines / Math.max(1, m.linesPerLeaf)))
}

/** A measurement is only valid for one geometry, so the key carries it. */
const keyFor = (m: LeafMetrics): string => `${Math.round(m.width)}|${m.linesPerLeaf}|${m.font}`

/**
 * Leaf counts for the whole archive, memoised per geometry.
 *
 * The windowing needs every count before it can size the scroller, so this is
 * the one place the whole corpus is measured at once. Cached against the
 * geometry AND the entry's own text, so editing one page re-measures one page
 * and resizing re-measures everything exactly once.
 */
export class LeafCounter {
  private cache = new Map<string, number>()

  count(entry: Entry, m: LeafMetrics): number {
    const key = `${entry.id}|${entry.updated_at}|${keyFor(m)}`
    const held = this.cache.get(key)
    if (held !== undefined) return held
    const leaves = leavesForEntry(entry, m)
    this.cache.set(key, leaves)
    return leaves
  }
}

/**
 * Every leaf of every page, in order — the unit the wall lays out at reading
 * zoom.
 *
 * Uniform in height, which is the property the whole surface rests on: a
 * 3,580-page archive windows cleanly because every cell is the same size. A
 * page now occupies a variable NUMBER of fixed-size cells rather than a
 * variable-size cell, so nothing about the scroll math changes.
 */
export function leavesFor(entries: Entry[], m: LeafMetrics, counter: LeafCounter): LeafRef[] {
  const out: LeafRef[] = []
  for (const entry of entries) {
    const of = counter.count(entry, m)
    for (let index = 0; index < of; index++) out.push({ entry, index, of })
  }
  return out
}
