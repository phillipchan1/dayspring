/**
 * Finding, on the read page, the line the writer was looking at in the editor.
 *
 * Leaving the editor lands on the reader scrolled to the same words (see
 * `ReaderArrival`). The two surfaces lay a page out alike, so in principle one
 * offset does it — but the editor only knows the true height of the lines it
 * has drawn, and estimates the rest. Jump to the middle of a long entry and the
 * distance back to its first line is a guess that can be a paragraph out.
 *
 * So the anchor is a line that is ON SCREEN, whose position is measured, and it
 * is found again on the page by its words. Markdown is the only thing between
 * the two: the editor's line is source, the reader's block is rendered text.
 * Comparing letters and digits alone steps over every marker either side adds
 * or drops.
 */

const MARKERS = /^\s*(?:[-*+>]|#{1,6}|\d+[.)]|\[[ xX]\])\s+/

/** A line of source, reduced to what would survive rendering: its letters and digits. */
export function anchorKey(line: string): string {
  let text = line
  while (MARKERS.test(text)) text = text.replace(MARKERS, '')
  return letters(text).slice(0, 48)
}

function letters(text: string): string {
  return text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()
}

/** Too few shared letters to call it the same line — "I", "the", a lone date. */
const MIN_SHARED = 8

/**
 * Which block starts with the anchor's words.
 *
 * The longest shared opening wins, so a link or a footnote part-way along a
 * line (whose source carries letters the page does not) still finds its
 * paragraph. `near` breaks a tie between blocks that open the same way — a
 * refrain, a list of days — in favour of the one closest to where the line was
 * expected. -1 when nothing shares enough to be trusted.
 */
export function findAnchorBlock(key: string, blocks: readonly string[], near: number): number {
  if (!key) return -1
  const need = Math.min(MIN_SHARED, key.length)
  let best = -1
  let bestShared = 0
  blocks.forEach((block, i) => {
    const text = letters(block.slice(0, 200))
    let shared = 0
    while (shared < key.length && shared < text.length && key[shared] === text[shared]) shared++
    if (shared < need) return
    const closer = Math.abs(i - near) < Math.abs(best - near)
    if (shared > bestShared || (shared === bestShared && closer)) {
      best = i
      bestShared = shared
    }
  })
  return best
}
