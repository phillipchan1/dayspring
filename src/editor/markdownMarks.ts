import type { DelimiterType, InlineContext, MarkdownConfig } from '@lezer/markdown'
import { tags } from '@lezer/highlight'
import { NAMED_COLOR_PATTERN } from '@/lib/highlightColors'

/**
 * Two inline extensions the CommonMark grammar doesn't have but a journal wants:
 * `==highlight==` and `++underline++`.
 *
 * Both are real grammar nodes rather than regex decorations, for one reason that
 * outweighs the extra code: concealment (concealMarkers.ts) hides marker NODES.
 * A regex-driven highlight would need a second, independent regex inside the
 * conceal plugin, and when the two disagreed the failure mode is the worst one
 * available — markers hidden with no wash painted, i.e. characters silently
 * vanishing from someone's entry. One node, one source of truth.
 *
 * The flanking rules (copied from the library's own Strikethrough) come free
 * with that choice, and they are load-bearing: `a == b == c` and `C++ and C++`
 * must stay prose, and `` `x ==y== z` `` must stay literal inside the code span.
 *
 * Shape mirrors Strikethrough in @lezer/markdown 1.6.4.
 */

// The library's own Punctuation test, which it doesn't export.
let Punctuation = /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~\xA1‐-‧]/
try {
  Punctuation = new RegExp('[\\p{S}|\\p{P}]', 'u')
} catch {
  // Older engine without unicode property escapes — the ASCII class stands in.
}

const HighlightDelim: DelimiterType = { resolve: 'Highlight', mark: 'HighlightMark' }
const UnderlineDelim: DelimiterType = { resolve: 'Underline', mark: 'UnderlineMark' }

/** `{rose}` etc. immediately after an opening `==`. Anything else is content. */
const COLOR_RE = new RegExp(`^\\{(?:${NAMED_COLOR_PATTERN})\\}`)
/** Longest possible colour spec, so we slice a bounded window to test it. */
const COLOR_WINDOW = 8

const CHAR_EQUALS = 61 /* '=' */
const CHAR_PLUS = 43 /* '+' */

function flanking(cx: InlineContext, from: number, to: number) {
  const before = cx.slice(from - 1, from)
  const after = cx.slice(to, to + 1)
  const sBefore = /\s|^$/.test(before)
  const sAfter = /\s|^$/.test(after)
  const pBefore = Punctuation.test(before)
  const pAfter = Punctuation.test(after)
  return {
    open: !sAfter && (!pAfter || sBefore || pBefore),
    close: !sBefore && (!pBefore || sAfter || pAfter),
  }
}

/**
 * `==text==` (amber) and `=={rose}text==`.
 *
 * The colour spec is folded INTO the opening delimiter's range, so the
 * `HighlightMark` node covers `=={rose}` whole. That's what lets the conceal
 * plugin hide the colour with no special case, and what lets the decoration
 * plugin read the colour straight off the marker's text.
 */
export const HighlightExtension: MarkdownConfig = {
  defineNodes: [
    // No tag: the wash is per-instance colour, painted by highlightDecoration.ts.
    { name: 'Highlight' },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx, next, pos) {
        if (next != CHAR_EQUALS || cx.char(pos + 1) != CHAR_EQUALS) return -1
        if (cx.char(pos + 2) == CHAR_EQUALS) return -1

        const window = cx.slice(pos + 2, Math.min(pos + 2 + COLOR_WINDOW, cx.end))
        const color = COLOR_RE.exec(window)
        const end = pos + 2 + (color ? color[0].length : 0)

        const { open, close } = flanking(cx, pos, end)
        // A coloured delimiter states an intent to open, so it never closes —
        // otherwise `=={rose}a== and ==b==` could resolve back-to-front.
        return cx.addDelimiter(HighlightDelim, pos, end, open, !color && close)
      },
      after: 'Emphasis',
    },
  ],
}

/**
 * `++text++`. Markdown has no underline: `__` is CommonMark's strong emphasis
 * and `<u>` is hostile to read raw. `++` collides with nothing inline (a bare
 * `+` is only meaningful as a list marker at line start) and python-markdown
 * already reads it as `<ins>`.
 */
export const UnderlineExtension: MarkdownConfig = {
  defineNodes: [
    { name: 'Underline', style: { 'Underline/...': tags.special(tags.emphasis) } },
    { name: 'UnderlineMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Underline',
      parse(cx, next, pos) {
        if (next != CHAR_PLUS || cx.char(pos + 1) != CHAR_PLUS) return -1
        if (cx.char(pos + 2) == CHAR_PLUS) return -1
        const { open, close } = flanking(cx, pos, pos + 2)
        return cx.addDelimiter(UnderlineDelim, pos, pos + 2, open, close)
      },
      after: 'Emphasis',
    },
  ],
}
