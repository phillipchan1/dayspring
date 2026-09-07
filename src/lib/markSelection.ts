import { MARK_KIND } from './markKinds'
import { isPracticeTokenLine } from './practiceTokens'
import { formatSpiritualBlock, parseSpiritualBlocks } from './spiritualBlocks'
import type { SpiritualItemType } from './types'

/** A document edit that turns a run of the writer's lines into a marking. */
export interface MarkWrap {
  /** Range to replace — always whole lines. */
  from: number
  to: number
  /** The fenced block that replaces it. */
  insert: string
  /** The writer's own words, which are what the fence now carries. */
  content: string
}

/**
 * Wrap the writer's own lines in a kind's fence.
 *
 * **Marking is a line act, not a span act**, and that is a decision rather than a
 * limitation. A fence is a block construct, so marking half a sentence would
 * mean splitting the paragraph around it — the writing rearranging itself
 * because someone reached for the margin. The untyped mark (D-016) stays
 * span-level and unchanged; it stores a quote and draws over it, and it is the
 * gesture for "this phrase, exactly".
 *
 * Returns null when the range can't be marked rather than doing something
 * approximate to it. Three cases:
 *
 *   · nothing but blank lines
 *   · a range touching a marking that already exists — a fence inside a fence is
 *     not a document anyone can edit back out of
 *   · a range touching a practice's hidden token lines, which carry the ritual's
 *     structure and are not the writer's words at all
 */
export function wrapLinesInFence(
  markdown: string,
  selFrom: number,
  selTo: number,
  kind: SpiritualItemType,
  id: string,
): MarkWrap | null {
  const len = markdown.length
  const a = Math.max(0, Math.min(selFrom, len))
  const b = Math.max(a, Math.min(selTo, len))

  // Grow to whole lines: the mark belongs to the paragraph, not to the drag.
  let start = markdown.lastIndexOf('\n', a - 1) + 1
  let endNl = markdown.indexOf('\n', b)
  let end = endNl === -1 ? len : endNl

  // A selection that ends exactly at a line start (a full-line drag) shouldn't
  // pull in the line below it.
  if (b > a && b === start) end = b
  else if (b < a) end = a

  const lines = markdown.slice(start, end).split('\n')

  // Trim blank lines off both ends — a drag that overshoots into the gap between
  // paragraphs should mark the paragraph, not the gap.
  let first = 0
  let last = lines.length - 1
  while (first <= last && lines[first]!.trim() === '') {
    start += lines[first]!.length + 1
    first++
  }
  while (last >= first && lines[last]!.trim() === '') {
    end -= lines[last]!.length + 1
    last--
  }
  if (first > last) return null

  const body = lines.slice(first, last + 1)
  if (body.some((line) => isPracticeTokenLine(line.trim()))) return null

  // Any overlap with an existing marking, in either direction.
  for (const block of parseSpiritualBlocks(markdown)) {
    if (block.from < end && block.to > start) return null
  }

  const content = body.join('\n')
  return {
    from: start,
    to: end,
    insert: formatSpiritualBlock(kind, id, content),
    content,
  }
}

/** True when this kind can be made from words already on the page. */
export function canMarkExistingLines(kind: SpiritualItemType): boolean {
  // Scripture is the one kind whose words are not the writer's own — it carries
  // verbatim ESV text fetched by reference, so there is nothing to wrap.
  return MARK_KIND[kind].capture !== 'scripture'
}
