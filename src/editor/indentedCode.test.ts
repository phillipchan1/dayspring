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
  extensions: { remove: ['IndentedCode'] },
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
