import { MARK_KIND } from '@/lib/markKinds'
import type { SpiritualItemType } from '@/lib/types'

/**
 * A marking's hand.
 *
 * Drawn rather than iconified: these are meant to read as something a person put
 * on a page, not as UI. Each is a stroke someone actually makes in a margin — a
 * rule, a bracket left open, a point of warmth.
 *
 * The margin carries no kind labels (§ Marks: "the hand is the label"), so a
 * marking has to be legible as *what it is* before you read a word of it. If the
 * label had to do that work the drawing would be decoration.
 *
 * Two constraints are encoded here rather than left to taste:
 *   · Nothing rises. Principle 1 forbids vertical valence — a glyph that climbed
 *     beside someone's spiritual life would be a grade.
 *   · A sense gets a bracket that opens and does not close. A sense is held, not
 *     concluded (1 Thess 5:21 is the writer's call, never the app's).
 *
 * Returned as markup rather than as React so the CodeMirror widget in the
 * editor and the note in the open margin draw the identical thing. Every string
 * here is a module constant — nothing user-supplied reaches `innerHTML`.
 *
 * No SVG gradients, deliberately: a `<linearGradient id>` repeated per glyph
 * either collides across instances or has to be uniquified, and uniquifying
 * breaks the widget's `eq()`. Colour that needs a ramp is a CSS background on a
 * plain element instead.
 */


export function markGlyphClass(kind: SpiritualItemType): string {
  return `ds-glyph ds-glyph--${kind}`
}

export function markGlyphHtml(kind: SpiritualItemType): string {
  switch (kind) {
    // The Lamp's ember→gold rule, so a verse speaks the same language in the
    // margin that it speaks on the canon map.
    case 'scripture':
      return '<span class="ds-glyph__rule"></span>'
    // Warmth, borrowed from the Altar's language: no flame, no edge, no count.
    case 'prayer':
      return '<span class="ds-glyph__ember"></span>'
    // A bracket that opens and does not close.
    case 'sense':
      return stroke(
        '<path d="M9 2 H4.2 A1.2 1.2 0 0 0 3 3.2 V18.8 A1.2 1.2 0 0 0 4.2 20 H6.6" ' +
          'stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />',
      )
    // A shallow bowl with something resting in it. Received, not achieved.
    case 'gift':
      return stroke(
        '<path d="M2.6 9.5 A3.4 3.4 0 0 0 9.4 9.5" stroke="currentColor" stroke-width="1.4" ' +
          'stroke-linecap="round" fill="none" />' +
          '<circle cx="6" cy="5.6" r="1.5" fill="currentColor" />',
      )
    /*
     * A ring left open. Desire is a reaching, so the stroke travels toward
     * something and does not close on it — and it travels sideways, because a
     * glyph that rose would be saying that wanting more is better.
     */
    case 'desire':
      return stroke(
        '<path d="M8.6 7.4 A4.4 4.4 0 1 0 8.6 14.6" stroke="currentColor" stroke-width="1.4" ' +
          'stroke-linecap="round" fill="none" />' +
          '<circle cx="10.4" cy="11" r="1.15" fill="currentColor" />',
      )
    // A notch. Flat on purpose — nothing here rises.
    case 'learned':
      return stroke(
        '<path d="M2.5 11 H9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />' +
          '<path d="M6 7.6 V14.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />',
      )
    // The brace people actually draw beside a paragraph they want to keep.
    case 'story':
      return stroke(
        '<path d="M8.5 1.5 C5.5 1.5 6.6 9.4 3.4 11 C6.6 12.6 5.5 20.5 8.5 20.5" ' +
          'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />',
      )
    /*
     * A line with a gap in it. Not a cross and not an X — absence is a gap,
     * never a mark against you, and the drawing has to say that before the
     * label does.
     */
    case 'absence':
      return stroke(
        '<path d="M6 2 V8.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />' +
          '<path d="M6 13.6 V20" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />',
      )
  }
}

function stroke(body: string): string {
  return (
    '<svg class="ds-glyph__svg" viewBox="0 0 12 22" fill="none" aria-hidden="true">' +
    body +
    '</svg>'
  )
}

/**
 * One glyph as DOM, for the two places in the editor that draw one: the margin
 * widget beside a prayer or a sense, and the scripture block widget, which has
 * to draw its own because a decoration inside a replaced range is swallowed.
 * Both must sit on the rule identically, so both come from here.
 */
export function buildGlyphElement(kind: SpiritualItemType, id: string): HTMLElement {
  const el = document.createElement('span')
  el.className = `cm-mark-glyph ${markGlyphClass(kind)}`
  el.setAttribute('contenteditable', 'false')
  el.dataset.markId = id
  // Hovering gives the name, for anyone who wants it. Nothing is labelled on
  // the page itself — the hand is the label.
  el.title = MARK_KIND[kind].label
  el.innerHTML = markGlyphHtml(kind)
  return el
}
