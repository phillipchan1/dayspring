import { markdownLanguage } from '@codemirror/lang-markdown'
import type { DelimiterType, InlineContext, InlineParser, MarkdownConfig } from '@lezer/markdown'
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
const CHAR_STAR = 42 /* '*' */
const CHAR_UNDERSCORE = 95 /* '_' */
const CHAR_TILDE = 126 /* '~' */
const CHAR_PLUS = 43 /* '+' */

const SPACED_CLOSER_FOLLOWER = /^(?:[\s.,;:!?…)\]}”’»—–]|)$/

/**
 * A delimiter run that CommonMark would refuse to close only because spaces
 * sit just before it: `*text *`, `**text **`, `~~text ~~`.
 *
 * Writers produce this shape all the time — a double-click or drag selection
 * that swallowed the trailing space, then the format bar or a hand-typed
 * closer. CommonMark's answer ("not right-flanking, so literal") reads as a
 * bug to anyone typing in a live-preview editor, and `==text ==` already
 * paints, so the marks have to agree.
 *
 * Deliberately narrow, so the new closers can't eat ordinary prose:
 *  - spaces or tabs only, never a newline (`*a\n*` stays literal), with a
 *    real character before them (not the start of the line);
 *  - the run must be followed by whitespace, the end of the text, or closing
 *    punctuation (`**Amen **.`). A run followed by a letter, a bracket or a
 *    quote is an OPENER (`a *(x)*`, `a *b*`, `a *"q"*`) and keeps its
 *    CommonMark meaning.
 * It only ever makes a delimiter able to close; with no opener before it
 * the delimiter stays inert, exactly as before.
 */
export function isSpacedCloser(cx: InlineContext, from: number, to: number): boolean {
  if (!SPACED_CLOSER_FOLLOWER.test(cx.slice(to, to + 1))) return false
  let i = from
  while (/^[ \t]$/.test(cx.slice(i - 1, i))) i--
  if (i === from) return false
  const lead = cx.slice(i - 1, i)
  return lead !== '' && !/\s/.test(lead)
}

/**
 * Wrap one of the library's own inline parsers so a spaced closer is judged as
 * if it were flush against the text. The delimiter types the library pairs on
 * (`Emphasis*`, strikethrough) are private, so re-using its parser — fed a
 * context whose view of "the character before" is a letter — is the only way
 * to produce delimiters that still resolve with the originals, `**`/`***`
 * run-length handling and the rule of three included.
 */
function withSpacedClosers(name: string, chars: number[]): InlineParser | null {
  const base = markdownLanguage.parser as unknown as {
    inlineParsers: (InlineParser['parse'] | undefined)[]
    inlineNames: string[]
  }
  const parse = base.inlineParsers[base.inlineNames.indexOf(name)]
  if (!parse) return null
  return {
    name,
    parse(cx, next, pos) {
      if (!chars.includes(next)) return parse(cx, next, pos)
      let end = pos + 1
      while (cx.char(end) == next) end++
      if (!isSpacedCloser(cx, pos, end)) return parse(cx, next, pos)
      // Prototype-linked rather than a Proxy: `parts` stays the one real array.
      const flush = Object.create(cx) as InlineContext
      flush.slice = (from, to) => (from === pos - 1 && to === pos ? 'x' : cx.slice(from, to))
      return parse(flush, next, pos)
    },
  }
}

const spacedEmphasis = withSpacedClosers('Emphasis', [CHAR_STAR, CHAR_UNDERSCORE])
const spacedStrike = withSpacedClosers('Strikethrough', [CHAR_TILDE])

/**
 * `*text *`, `_text _`, `**text **`, `~~text ~~` — see `isSpacedCloser`. Replaces
 * the library's parsers of the same name in place, so every other rule about
 * emphasis and strikethrough is still the library's.
 */
export const SpacedCloserExtension: MarkdownConfig = {
  parseInline: [spacedEmphasis, spacedStrike].filter((p): p is InlineParser => p !== null),
}

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

        const { open } = flanking(cx, pos, end)
        // Uncoloured closers always close. Open flanking still rejects
        // `a == b == c` (a space after `==` cannot open), but a wrap that
        // captured a trailing space (`==phrase ==`) still paints — the
        // format bar and a two-line selection both produce that shape.
        // Coloured delimiters never close, so `=={rose}a== and ==b==`
        // cannot resolve back-to-front.
        return cx.addDelimiter(HighlightDelim, pos, end, open, !color)
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
        return cx.addDelimiter(UnderlineDelim, pos, pos + 2, open, close || isSpacedCloser(cx, pos, pos + 2))
      },
      after: 'Emphasis',
    },
  ],
}
