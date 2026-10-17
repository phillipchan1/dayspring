import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { HighlightExtension, SpacedCloserExtension, UnderlineExtension } from './markdownMarks'

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: [
    { remove: ['IndentedCode', 'SetextHeading'] },
    HighlightExtension,
    UnderlineExtension,
    SpacedCloserExtension,
  ],
})

interface Node {
  name: string
  from: number
  to: number
  text: string
}

function nodes(doc: string): Node[] {
  const state = EditorState.create({ doc, extensions: [mdExtension] })
  const out: Node[] = []
  syntaxTree(state).iterate({
    enter: (n) => {
      out.push({ name: n.name, from: n.from, to: n.to, text: doc.slice(n.from, n.to) })
    },
  })
  return out
}

const names = (doc: string) => nodes(doc).map((n) => n.name)
const find = (doc: string, name: string) => nodes(doc).filter((n) => n.name === name)

describe('Highlight (==)', () => {
  it('parses a bare highlight', () => {
    expect(names('a ==word== b')).toContain('Highlight')
    expect(find('a ==word== b', 'HighlightMark').map((n) => n.text)).toEqual(['==', '=='])
  })

  it('folds the colour spec INTO the opening mark', () => {
    // This is what lets concealMarkers hide `{rose}` with no special case, and
    // lets highlightDecoration read the colour straight off the marker.
    const marks = find('=={rose}word==', 'HighlightMark')
    expect(marks.map((n) => n.text)).toEqual(['=={rose}', '=='])
  })

  it('nests other inline marks', () => {
    const ns = names('==**bold** and *ital*==')
    expect(ns).toContain('Highlight')
    expect(ns).toContain('StrongEmphasis')
    expect(ns).toContain('Emphasis')
  })

  // The reason this is a grammar extension and not a regex.
  it('does NOT match spaced equals used as prose or math', () => {
    expect(names('a == b == c')).not.toContain('Highlight')
    expect(names('let x == y == z')).not.toContain('Highlight')
  })

  it('does NOT match inside inline code', () => {
    expect(names('`x ==y== z`')).not.toContain('Highlight')
  })

  // A run of equals with nothing to close against stays plain text — which is
  // what protects a `===` divider line someone types out of habit.
  it('does not match a bare run of equals', () => {
    expect(names('===')).not.toContain('Highlight')
    expect(names('====')).not.toContain('Highlight')
  })

  // `===x===` behaves like the library's own `~~~x~~~`: the delimiter shifts by
  // one rather than being rejected, so the outer `=` stay as text and the marks
  // are still exactly two characters. Asserted so a parser change can't quietly
  // start swallowing the extra equals.
  it('never lets a mark grow past two equals', () => {
    expect(find('===x===', 'HighlightMark').map((n) => n.text)).toEqual(['==', '=='])
  })

  it('treats an unknown colour token as content', () => {
    const marks = find('=={nope}word==', 'HighlightMark')
    expect(marks.map((n) => n.text)).toEqual(['==', '=='])
  })

  // The format bar wraps the whole selection, so a two-line highlight is
  // `==line\nline==`. If this fails, the markers stay visible and there is no
  // wash — which is exactly the "highlighting did nothing" report.
  it('parses a highlight that spans a line break', () => {
    expect(names('==foo\nbar==')).toContain('Highlight')
    expect(find('==foo\nbar==', 'HighlightMark').map((n) => n.text)).toEqual(['==', '=='])
  })

  it('parses a highlight whose closer sits after a space', () => {
    // Selecting a phrase often includes the trailing space, so the wrap is
    // `==phrase ==`. Obsidian-style `==phrase ==` should still paint.
    expect(names('==foo ==')).toContain('Highlight')
  })

  it('parses a two-line wrap with a trailing space before the closer', () => {
    const doc = '==give me a one thing heart father.\ngive me a heart that loves you above all else. =='
    expect(names(doc)).toContain('Highlight')
  })
})

describe('Underline (++)', () => {
  it('parses an underline', () => {
    expect(names('a ++word++ b')).toContain('Underline')
    expect(find('a ++word++ b', 'UnderlineMark').map((n) => n.text)).toEqual(['++', '++'])
  })

  // C++ is the case that makes a naive regex unshippable.
  it('does NOT match C++ prose', () => {
    expect(names('I wrote C++ and then more C++ today')).not.toContain('Underline')
    expect(names('1 ++ 2')).not.toContain('Underline')
  })

  it('does NOT match inside inline code', () => {
    expect(names('`a ++b++ c`')).not.toContain('Underline')
  })

  it('does not match a bare run of pluses', () => {
    expect(names('+++')).not.toContain('Underline')
    expect(names('++++')).not.toContain('Underline')
  })

  it('never lets a mark grow past two pluses', () => {
    expect(find('+++x+++', 'UnderlineMark').map((n) => n.text)).toEqual(['++', '++'])
  })
})

describe('the two together', () => {
  it('nests underline inside highlight', () => {
    const ns = names('=={sky}++both++==')
    expect(ns).toContain('Highlight')
    expect(ns).toContain('Underline')
  })

  it('leaves a leading "+ " list marker alone', () => {
    expect(names('+ an item')).not.toContain('Underline')
  })
})

describe('spaced closers (`*text *`)', () => {
  const span = (doc: string, name: string) => find(doc, name).map((n) => n.text)

  it('closes every inline mark when spaces sit before the closer', () => {
    expect(span('*a *', 'Emphasis')).toEqual(['*a *'])
    expect(span('_a _', 'Emphasis')).toEqual(['_a _'])
    expect(span('**a **', 'StrongEmphasis')).toEqual(['**a **'])
    expect(span('__a __', 'StrongEmphasis')).toEqual(['__a __'])
    expect(span('~~a ~~', 'Strikethrough')).toEqual(['~~a ~~'])
    expect(span('++a ++', 'Underline')).toEqual(['++a ++'])
    expect(span('==a ==', 'Highlight')).toEqual(['==a =='])
  })

  it('takes several spaces or a tab, and sits fine mid-sentence', () => {
    expect(span('x *a  * y', 'Emphasis')).toEqual(['*a  *'])
    expect(span('x *a\t* y', 'Emphasis')).toEqual(['*a\t*'])
    expect(span('***a ***', 'StrongEmphasis')).toEqual(['**a **'])
  })

  it('still marks only the asterisks, so concealment hides exactly them', () => {
    expect(find('*a *', 'EmphasisMark').map((n) => n.text)).toEqual(['*', '*'])
  })

  it('works inside headings, quotes and lists, and around other marks', () => {
    expect(names('# *a *')).toContain('Emphasis')
    expect(names('> *a *')).toContain('Emphasis')
    expect(names('- *a *')).toContain('Emphasis')
    expect(names('*a `b` c *')).toContain('Emphasis')
    expect(names('*a **b** c *')).toContain('StrongEmphasis')
    expect(names('**a *b* c **')).toContain('Emphasis')
  })

  it('does not reach across a line break or touch code', () => {
    expect(names('*a\n*')).not.toContain('Emphasis')
    expect(names('`*a *`')).not.toContain('Emphasis')
    expect(names('\\*a *')).not.toContain('Emphasis')
  })

  it('closes before sentence punctuation, but not before a bracket or quote', () => {
    expect(span('**Amen **.', 'StrongEmphasis')).toEqual(['**Amen **'])
    expect(span('*so far *, then', 'Emphasis')).toEqual(['*so far *'])
    expect(span('x *(a)* y', 'Emphasis')).toEqual(['*(a)*'])
    expect(span('x *"a"* y', 'Emphasis')).toEqual(['*"a"*'])
  })

  it('leaves an opener alone: a run followed by text is never a closer', () => {
    expect(span('x *(a)* y', 'Emphasis')).toEqual(['*(a)*'])
    expect(span('*a *b*', 'Emphasis')).toEqual(['*b*'])
    expect(span('*a* *b *', 'Emphasis')).toEqual(['*a*', '*b *'])
  })

  it('keeps the strict rules everywhere else', () => {
    expect(names('a_b_c')).not.toContain('Emphasis')
    expect(names('* text*')).not.toContain('Emphasis')
    expect(names('5 * 3 and 2 * 4')).not.toContain('Emphasis')
    expect(names('a ** b and c ** d')).not.toContain('StrongEmphasis')
    expect(names('a ~~ b ~~ c')).not.toContain('Strikethrough')
    expect(names('C++ and C++')).not.toContain('Underline')
  })
})
