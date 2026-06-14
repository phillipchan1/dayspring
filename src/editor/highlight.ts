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
  // Headings — visibly larger, brighter, bold.
  { tag: t.heading1, fontSize: '1.6em', fontWeight: '700', color: 'var(--md-heading)', lineHeight: '1.3' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: '700', color: 'var(--md-heading)', lineHeight: '1.3' },
  { tag: t.heading3, fontSize: '1.2em', fontWeight: '600', color: 'var(--md-heading)' },
  { tag: [t.heading4, t.heading5, t.heading6], fontSize: '1.05em', fontWeight: '600', color: 'var(--md-heading)' },

  // Inline emphasis.
  { tag: t.strong, fontWeight: '700', color: 'var(--text-bright)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--md-emphasis)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-dim)' },

  // Code.
  { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--md-code)' },

  // Links.
  { tag: t.link, color: 'var(--md-link)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--md-link)' },

  // Quotes.
  { tag: t.quote, fontStyle: 'italic', color: 'var(--md-quote)' },

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
