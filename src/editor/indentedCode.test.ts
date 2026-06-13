import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { describe, expect, it } from 'vitest'

// Regression guard for the "serif entry suddenly renders in mono" bug.
//
// CommonMark turns any line indented ≥4 spaces (or a tab) at a block start into
// an *indented code block*. Its content is tagged `tags.monospace`, which the
// editor's highlight (highlight.ts) renders in `--font-mono` — so one stray
// leading-indented line silently flips a whole entry to a monospace face,
// ignoring the user's writing-font setting. The editor disables that rule with
// `extensions: { remove: ['IndentedCode'] }`. This must keep working, and
// fenced ``` blocks (scripture/altar spiritual blocks rely on them) must not.

// Mirrors the markdown() config in Editor.tsx.
const lang = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: { remove: ['IndentedCode', 'SetextHeading'] },
}).language

function nodeNames(src: string): string[] {
  const names: string[] = []
  lang.parser.parse(src).iterate({ enter: (n) => void names.push(n.name) })
  return names
}

describe('editor markdown: indented code blocks are disabled', () => {
  it('does not turn a space-indented first line into a code block', () => {
    expect(nodeNames('                first line indented\nsecond line\n')).not.toContain('CodeBlock')
  })

  it('does not turn a tab-indented line into a code block', () => {
    expect(nodeNames('\tindented with a tab\nnext\n')).not.toContain('CodeBlock')
  })

  it('does not turn an indented line after a blank line into a code block', () => {
    expect(nodeNames('intro\n\n        indented block\nmore\n')).not.toContain('CodeBlock')
  })

  it('still parses fenced ``` blocks (used by spiritual blocks)', () => {
    expect(nodeNames('before\n\n```\nfenced code\n```\nafter\n')).toContain('FencedCode')
  })
})

describe('editor markdown: setext headings are disabled', () => {
  // CommonMark setext headings: `text\n-` → H2, `text\n=` → H1. Typing a dash
  // on the line after any prose line would instantly re-style it as a heading.
  it('does not turn text + dash-underline into a heading', () => {
    const names = nodeNames('some prose\n-\n')
    expect(names).not.toContain('SetextHeading1')
    expect(names).not.toContain('SetextHeading2')
  })

  it('does not turn text + equals-underline into a heading', () => {
    const names = nodeNames('some prose\n=\n')
    expect(names).not.toContain('SetextHeading1')
    expect(names).not.toContain('SetextHeading2')
  })

  it('still parses ATX headings (## prefix) for intentional formatting', () => {
    expect(nodeNames('## a heading\n')).toContain('ATXHeading2')
  })
})
