// Where a marking actually sits on the page.
//
// ── The defect this exists to fix ───────────────────────────────────────────
//
// A subject and a marking were never the same kind of thing. A subject is a
// regex over the prose: it lights particular LINES, and a card shows you which
// ones. A marking was a page-level boolean with no text and no position, because
// `listMarkings` fetches only `entry_id` and `type`.
//
// So lighting "Tiffany" and "Scripture" together returned pages where both were
// true SOMEWHERE, and opening one showed nothing joining them — not because the
// join was hidden, but because it had never been computed. The two halves of
// the filter did not meet anywhere the reader could see.
//
// With `markingsForEntry` a marking has words again, and words can be found in
// the page. What is found is drawn where it is; what is not found is a declared
// block, which was never in the prose to begin with, and belongs in the margin.

import { entryContentLines } from '@/lib/entryLabels'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import { markGlyphClass, markGlyphHtml } from '@/editor/markGlyph'
import { MARK_KIND } from '@/lib/markKinds'
import type { PageMarking } from '@/lib/spiritual'

/**
 * Both sides of a comparison, flattened to the same shape.
 *
 * Markers are unwrapped rather than deleted because the stored sentence is raw
 * markdown and the rendered page is not — a marking harvested from
 * `**that morning**` is the text, not the asterisks. Curly quotes are folded
 * for the same reason: the writer's keyboard and the importer's disagree about
 * apostrophes, and neither of them meant anything by it.
 */
export function flatten(text: string): string {
  return stripMarkdownMarkers(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Short enough to match by accident.
 *
 * The same floor `pageExcerpt`'s `isSetApart` uses, and for the same reason: a
 * six-character needle is in half the paragraphs on the page.
 */
const MIN_LOCATABLE = 12

export interface SortedMarkings {
  /** Its sentence is in the page's own prose — it can be shown where it sits. */
  inProse: PageMarking[]
  /**
   * Its sentence is not.
   *
   * Almost always a DECLARED block: `entryContentLines` strips the fences
   * before anything sees them, and `stripSpiritualBlocks` keeps them off the
   * rendered page too, so a typed `/pray` genuinely is not in the prose. It is
   * not missing — it is its own thing, and the margin is where it goes.
   */
  loose: PageMarking[]
}

/** Split the markings on a page by whether the page says them. */
export function sortMarkings(
  bodyMarkdown: string | null | undefined,
  markings: readonly PageMarking[],
): SortedMarkings {
  const prose = flatten(entryContentLines(bodyMarkdown).join(' '))
  const inProse: PageMarking[] = []
  const loose: PageMarking[] = []
  for (const m of markings) {
    const needle = flatten(m.content)
    if (needle.length >= MIN_LOCATABLE && prose.includes(needle)) inProse.push(m)
    else loose.push(m)
  }
  return { inProse, loose }
}

/** Block elements a marking's sentence can live inside. */
const BLOCKS = 'p, li, blockquote, h1, h2, h3, h4, h5, h6'

/**
 * Draw the markings onto the blocks that carry them.
 *
 * The SMALLEST block containing the sentence, not the first: a paragraph inside
 * a blockquote contains it and so does the blockquote, and marking the quote
 * would claim the whole of it for one line inside it.
 *
 * Returns the ids it managed to place, so a caller can tell the difference
 * between "not in the prose" (already known) and "in the prose but the
 * rendering broke it across elements" (worth not silently swallowing).
 */
export function drawMarkings(root: HTMLElement, markings: readonly PageMarking[]): Set<string> {
  const placed = new Set<string>()
  if (markings.length === 0) return placed

  const blocks = [...root.querySelectorAll<HTMLElement>(BLOCKS)].map((el) => ({
    el,
    text: flatten(el.textContent ?? ''),
  }))
  if (blocks.length === 0) return placed

  const kindsOn = new Map<HTMLElement, string[]>()
  for (const m of markings) {
    const needle = flatten(m.content)
    if (needle.length < MIN_LOCATABLE) continue
    let best: { el: HTMLElement; text: string } | null = null
    for (const b of blocks) {
      if (!b.text.includes(needle)) continue
      if (!best || b.text.length < best.text.length) best = b
    }
    if (!best) continue
    placed.add(m.id)
    const held = kindsOn.get(best.el)
    if (held) {
      if (!held.includes(m.type)) held.push(m.type)
    } else {
      kindsOn.set(best.el, [m.type])
    }
  }

  for (const [el, kinds] of kindsOn) {
    el.setAttribute('data-marking', kinds.join(' '))
    const first = kinds[0] as keyof typeof MARK_KIND
    const tone = MARK_KIND[first]?.tone
    if (tone) el.style.setProperty('--mark-tone', tone)
    const named = kinds.map((k) => MARK_KIND[k as keyof typeof MARK_KIND]?.label ?? k)
    el.setAttribute('aria-label', named.join(' · '))

    /*
     * The kind's own hand, in the gutter beside the sentence.
     *
     * A flat coloured rule says "something is marked here" and makes you look
     * it up; the hand says WHICH — a scripture's ember-to-gold rule, a
     * prayer's warmth, a sense's bracket left open. It is the same drawing the
     * editor puts in its own margin, so a prayer looks like a prayer whether
     * you meet it while writing or while reading back, and there is no second
     * vocabulary to learn.
     *
     * The first kind only. Two markings on one sentence is real and rare, and
     * two hands stacked in one gutter reads as a defect rather than as
     * information — the `aria-label` above names them all.
     */
    const doc = el.ownerDocument
    const html = markGlyphHtml(first) as string | undefined
    // A kind the client does not know about (a row from a newer build) has no
    // hand to draw. The rule above still names it; a missing drawing is better
    // than a thrown render on a page someone is trying to read.
    if (!doc || !html || el.querySelector('.pg-read1__hand')) continue
    const hand = doc.createElement('span')
    hand.className = `pg-read1__hand ${markGlyphClass(first)}`
    hand.setAttribute('aria-hidden', 'true')
    /*
     * The kind's name, for the hover.
     *
     * A hand you cannot read is a decoration: the drawing says WHICH to someone
     * who already knows the six, and to everyone else it is a dot with no way
     * in. The name is carried on the element and revealed by CSS rather than
     * by `title`, because the native tooltip takes a second to appear, lands
     * wherever the pointer is, and cannot be styled to be small and quiet —
     * three things that matter on a page someone is reading.
     */
    hand.dataset.label = named.join(' · ')
    // Module constants from markGlyph.ts — nothing user-supplied reaches this.
    hand.innerHTML = html
    el.insertBefore(hand, el.firstChild)
  }
  return placed
}
