import { marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'
import { markdownForDisplay, type DisplayOptions } from './entryMarkdown'
import { isHighlightColor, NAMED_COLOR_PATTERN, type HighlightColor } from './highlightColors'

marked.setOptions({
  gfm: true,
  breaks: true, // journal entries: single newlines become <br>
})

interface HighlightToken extends Tokens.Generic {
  type: 'dsHighlight'
  color: HighlightColor
  tokens: Tokens.Generic[]
}
interface UnderlineToken extends Tokens.Generic {
  type: 'dsUnderline'
  tokens: Tokens.Generic[]
}

// The lookarounds mirror the flanking rules in editor/markdownMarks.ts, so
// `a == b == c` and `C++ and C++` stay prose here exactly as they do while
// typing. Without them, print output would disagree with the editor.
const HIGHLIGHT_RE = new RegExp(
  `^==(?:\\{(${NAMED_COLOR_PATTERN})\\})?(?!\\s)([\\s\\S]+?)(?<!\\s)==(?!=)`,
)
const UNDERLINE_RE = /^\+\+(?!\s)([\s\S]+?)(?<!\s)\+\+(?!\+)/

marked.use({
  extensions: [
    {
      name: 'dsHighlight',
      level: 'inline',
      // Without `start`, marked never offers the tokenizer the right offsets.
      start(src: string) {
        return src.indexOf('==')
      },
      tokenizer(src: string) {
        const m = HIGHLIGHT_RE.exec(src)
        if (!m) return undefined
        const named = m[1]
        return {
          type: 'dsHighlight',
          raw: m[0],
          color: named && isHighlightColor(named) ? named : 'amber',
          tokens: this.lexer.inlineTokens(m[2] ?? ''),
        } satisfies HighlightToken
      },
      renderer(token) {
        const t = token as HighlightToken
        return `<mark class="hl hl--${t.color}">${this.parser.parseInline(t.tokens)}</mark>`
      },
    },
    {
      name: 'dsUnderline',
      level: 'inline',
      start(src: string) {
        return src.indexOf('++')
      },
      tokenizer(src: string) {
        const m = UNDERLINE_RE.exec(src)
        if (!m) return undefined
        return {
          type: 'dsUnderline',
          raw: m[0],
          tokens: this.lexer.inlineTokens(m[1] ?? ''),
        } satisfies UnderlineToken
      },
      renderer(token) {
        const t = token as UnderlineToken
        return `<u class="ul">${this.parser.parseInline(t.tokens)}</u>`
      },
    },
  ],
})

/** Render markdown to sanitized HTML for the read-only reading view. */
export function renderMarkdown(md: string, opts: DisplayOptions = {}): string {
  const raw = marked.parse(markdownForDisplay(md, opts), { async: false })
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    // `class` is already in DOMPurify's default ALLOWED_ATTR, so this changes
    // nothing today — it's here so a future major that tightens the default
    // can't silently grey out every printed highlight. markdown.test.ts asserts
    // the class survives.
    ADD_ATTR: ['class'],
  })
}
