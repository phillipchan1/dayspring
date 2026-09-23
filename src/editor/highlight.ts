import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * Near-live inline markdown styling. The raw markdown stays in the document,
 * but syntax is styled in place: headings grow and brighten, **bold** renders
 * bold, *italic* italic, `code` gets a mono tint, quotes dim and indent, and
 * the markdown markers (#, *, >, `) fade back so the prose dominates.
 *
 * Colors come from the One Dark token set in themes.css (via var(--…)).
 */
export const markdownHighlight = HighlightStyle.define([
  // Headings and quotes are NOT here. They're line decorations — see
  // blockLineStyles in proseHighlighting.ts — so they can paint on the line
  // being typed without splitting its text (Safari autocorrect), and so their
  // `em` sizes can't compound with a mark nested inside the line.

  // Inline emphasis.
  { tag: t.strong, fontWeight: '700', color: 'var(--text-bright)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--md-emphasis)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-dim)' },
  // Underline (`++text++`, our own grammar extension — see markdownMarks.ts).
  // Two other things in this editor are already underlined: links, which carry
  // --md-link, and scripture references, a 1px gold hairline at 3px offset. A
  // formatting underline must read as neither, so it's thicker than the hairline
  // and drawn in a softened currentColor rather than any hue.
  {
    tag: t.special(t.emphasis),
    textDecoration: 'underline',
    textDecorationThickness: '0.075em',
    textUnderlineOffset: '0.18em',
    textDecorationColor: 'color-mix(in srgb, currentColor 55%, transparent)',
  },

  // Code.
  { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--md-code)' },

  // Links.
  { tag: t.link, color: 'var(--md-link)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--md-link)' },

  // List markers fade via t.processingInstruction below — the grammar tags
  // ListMark with it. Deliberately NO t.list rule: the markdown grammar applies
  // t.list to the entire list subtree (marker AND body), so coloring it would
  // also fade the body text — which then can't brighten as the active paragraph
  // in focus/typewriter mode. Body stays the default writing color.

  // The markdown markers themselves (#, *, _, >, `, -, link brackets) — faded.
  { tag: t.processingInstruction, color: 'var(--text-faint)' },
  { tag: t.contentSeparator, color: 'var(--text-faint)' },

  // Misc.
  { tag: t.meta, color: 'var(--text-faint)' },
])
