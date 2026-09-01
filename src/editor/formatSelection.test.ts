// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import {
  applyFormat,
  applyHighlight,
  buildInline,
  EMPTY_INLINE,
  expandTextualWrappers,
  parseInlineMarks,
  parseLink,
  toggleHighlight,
  type FormatAction,
} from './formatSelection'

describe('parseInlineMarks', () => {
  it('peels a single wrapped span', () => {
    expect(parseInlineMarks('**bold**')).toEqual({
      plain: 'bold',
      marks: { ...EMPTY_INLINE, bold: true },
    })
    expect(parseInlineMarks('*ital*').marks.italic).toBe(true)
    expect(parseInlineMarks('~~struck~~').marks.strike).toBe(true)
    expect(parseInlineMarks('`code`').marks.code).toBe(true)
    expect(parseInlineMarks('++under++').marks.underline).toBe(true)
  })

  it('peels bold + italic together', () => {
    const { plain, marks } = parseInlineMarks('***both***')
    expect(plain).toBe('both')
    expect(marks.bold && marks.italic).toBe(true)
  })

  it('peels bold that wraps an inner italic span', () => {
    // The closing ** is still the first occurrence, so this is one clean span.
    expect(parseInlineMarks('**a *b* c**')).toEqual({
      plain: 'a *b* c',
      marks: { ...EMPTY_INLINE, bold: true },
    })
  })

  // Regression: the old `startsWith && endsWith` check mis-peeled these and
  // corrupted the document on re-wrap (dangling markers).
  it('does NOT peel multiple spans that merely share an outer delimiter', () => {
    expect(parseInlineMarks('**a** and **b**').marks.bold).toBe(false)
    expect(parseInlineMarks('*a* *b*').marks.italic).toBe(false)
    expect(parseInlineMarks('`a` `b`').marks.code).toBe(false)
    expect(parseInlineMarks('~~a~~ ~~b~~').marks.strike).toBe(false)
    expect(parseInlineMarks('==a== and ==b==').marks.highlight).toBeNull()
    expect(parseInlineMarks('++a++ ++b++').marks.underline).toBe(false)
  })

  it('reads marker soup with no inner text as those marks, so a second press can clear it', () => {
    expect(parseInlineMarks('****')).toEqual({
      plain: '',
      marks: { ...EMPTY_INLINE, bold: true },
    })
    expect(parseInlineMarks('***')).toEqual({
      plain: '',
      marks: { ...EMPTY_INLINE, bold: true, italic: true },
    })
    expect(parseInlineMarks('plain text').marks).toEqual(EMPTY_INLINE)
  })

  it('peels stacked bold as one bold, not as *** around a leftover *', () => {
    expect(parseInlineMarks('****word****')).toEqual({
      plain: 'word',
      marks: { ...EMPTY_INLINE, bold: true },
    })
    expect(parseInlineMarks('******word******').marks.bold).toBe(true)
    expect(parseInlineMarks('******word******').plain).toBe('word')
    expect(parseInlineMarks('*****word*****')).toEqual({
      plain: 'word',
      marks: { ...EMPTY_INLINE, bold: true, italic: true },
    })
  })

  it('peels underscore emphasis the same as asterisks', () => {
    expect(parseInlineMarks('__bold__').marks.bold).toBe(true)
    expect(parseInlineMarks('_ital_').marks.italic).toBe(true)
    expect(parseInlineMarks('___both___').marks).toEqual({
      ...EMPTY_INLINE,
      bold: true,
      italic: true,
    })
  })

  it('peels stacked underline and strike', () => {
    expect(parseInlineMarks('++++word++++')).toEqual({
      plain: 'word',
      marks: { ...EMPTY_INLINE, underline: true },
    })
    expect(parseInlineMarks('~~~~word~~~~').marks.strike).toBe(true)
  })
})

describe('parseInlineMarks — highlight', () => {
  it('reads a bare == as amber', () => {
    expect(parseInlineMarks('==hi==')).toEqual({
      plain: 'hi',
      marks: { ...EMPTY_INLINE, highlight: 'amber' },
    })
  })

  it('reads a named colour out of the opening marker', () => {
    expect(parseInlineMarks('=={rose}hi==').marks.highlight).toBe('rose')
    expect(parseInlineMarks('=={sky}hi==').plain).toBe('hi')
  })

  // An unrecognised token is content, not a colour — `=={x} is a subset==`
  // must keep its braces.
  it('treats an unknown colour token as text', () => {
    expect(parseInlineMarks('=={nope}hi==')).toEqual({
      plain: '{nope}hi',
      marks: { ...EMPTY_INLINE, highlight: 'amber' },
    })
  })

  it('peels a highlight wrapping other marks', () => {
    const { plain, marks } = parseInlineMarks('=={sky}++a++==')
    expect(plain).toBe('a')
    expect(marks.highlight).toBe('sky')
    expect(marks.underline).toBe(true)
  })
})

describe('buildInline', () => {
  it('round-trips a clean span back to plain when toggled off', () => {
    const { plain, marks } = parseInlineMarks('**word**')
    expect(buildInline(plain, { ...marks, bold: false })).toBe('word')
  })

  it('rebuilds combined marks deterministically', () => {
    expect(buildInline('x', { ...EMPTY_INLINE, bold: true, italic: true })).toBe('***x***')
    // Strike is the innermost wrapper, bold/italic wrap around it.
    expect(buildInline('x', { ...EMPTY_INLINE, bold: true, strike: true })).toBe('**~~x~~**')
  })

  it('nests highlight outermost, then underline', () => {
    expect(buildInline('x', { ...EMPTY_INLINE, highlight: 'rose', bold: true })).toBe(
      '=={rose}**x**==',
    )
    expect(buildInline('x', { ...EMPTY_INLINE, highlight: 'amber' })).toBe('==x==')
    expect(buildInline('x', { ...EMPTY_INLINE, underline: true, italic: true })).toBe('++*x*++')
  })

  it('code wins over other marks', () => {
    expect(
      buildInline('x', {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
        code: true,
        highlight: 'rose',
      }),
    ).toBe('`x`')
  })

  it('emits markers around empty text so an empty caret pair can be rebuilt', () => {
    expect(buildInline('', { ...EMPTY_INLINE, bold: true })).toBe('****')
    expect(buildInline('', { ...EMPTY_INLINE, italic: true })).toBe('**')
    expect(buildInline('', EMPTY_INLINE)).toBe('')
  })

  it('round-trips through parseInlineMarks', () => {
    for (const src of ['=={sky}++a++==', '==**b**==', '++~~c~~++', '=={lilac}d==']) {
      const { plain, marks } = parseInlineMarks(src)
      expect(buildInline(plain, marks)).toBe(src)
    }
  })
})

describe('toggleHighlight', () => {
  it('turns off when the same colour is re-applied', () => {
    expect(toggleHighlight({ ...EMPTY_INLINE, highlight: 'rose' }, 'rose').highlight).toBeNull()
  })

  it('swaps to a different colour', () => {
    expect(toggleHighlight({ ...EMPTY_INLINE, highlight: 'rose' }, 'sky').highlight).toBe('sky')
  })

  it('clears code, which cannot coexist with a highlight', () => {
    expect(toggleHighlight({ ...EMPTY_INLINE, code: true }, 'amber').code).toBe(false)
  })
})

describe('parseLink', () => {
  it('parses a markdown link', () => {
    expect(parseLink('[label](https://x.com)')).toEqual({ plain: 'label', url: 'https://x.com' })
  })
  it('rejects plain text', () => {
    expect(parseLink('not a link')).toBeNull()
  })
})

describe('expandTextualWrappers', () => {
  it('widens a concealed-style inner selection out to its markers', () => {
    expect(expandTextualWrappers('**hello**', 2, 7)).toEqual({ from: 0, to: 9 })
    expect(expandTextualWrappers('=={rose}hi==', 8, 10)).toEqual({ from: 0, to: 12 })
    expect(expandTextualWrappers('[docs](https://x.com)', 1, 5)).toEqual({ from: 0, to: 21 })
  })

  it('keeps peeling stacked bold so one toggle can recover', () => {
    expect(expandTextualWrappers('****hello****', 4, 9)).toEqual({ from: 0, to: 13 })
  })
})

function viewWith(doc: string, from: number, to = from): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: from, head: to },
    }),
    parent: document.body,
  })
}

function apply(doc: string, from: number, to: number, action: FormatAction, times = 1): string {
  const view = viewWith(doc, from, to)
  for (let i = 0; i < times; i++) applyFormat(view, action)
  const next = view.state.doc.toString()
  view.destroy()
  return next
}

describe('applyFormat — never stacks markers', () => {
  it('toggles bold on a selection instead of wrapping again', () => {
    expect(apply('hello', 0, 5, 'bold')).toBe('**hello**')
    expect(apply('hello', 0, 5, 'bold', 2)).toBe('hello')
    expect(apply('hello', 0, 5, 'bold', 10)).toBe('hello')
    expect(apply('hello', 0, 5, 'bold', 11)).toBe('**hello**')
  })

  it('unwraps when only the inner word is selected (concealed markers)', () => {
    expect(apply('**hello**', 2, 7, 'bold')).toBe('hello')
    expect(apply('*hello*', 1, 6, 'italic')).toBe('hello')
    expect(apply('++hello++', 2, 7, 'underline')).toBe('hello')
    expect(apply('~~hello~~', 2, 7, 'strike')).toBe('hello')
    expect(apply('`hello`', 1, 6, 'code')).toBe('hello')
    expect(apply('==hello==', 2, 7, 'highlight')).toBe('hello')
  })

  it('recovers from already-stacked bold in one press', () => {
    expect(apply('****hello****', 4, 9, 'bold')).toBe('hello')
    expect(apply('**********hello**********', 10, 15, 'bold')).toBe('hello')
  })

  it('does not keep adding asterisks on an empty caret', () => {
    expect(apply('', 0, 0, 'bold')).toBe('****')
    expect(apply('', 0, 0, 'bold', 2)).toBe('')
    expect(apply('', 0, 0, 'bold', 10)).toBe('')
    expect(apply('', 0, 0, 'italic', 2)).toBe('')
    expect(apply('', 0, 0, 'underline', 2)).toBe('')
    expect(apply('', 0, 0, 'strike', 2)).toBe('')
    expect(apply('', 0, 0, 'code', 2)).toBe('')
    expect(apply('', 0, 0, 'highlight', 2)).toBe('')
  })

  it('clears a leftover empty pair instead of nesting another', () => {
    expect(apply('****', 2, 2, 'bold')).toBe('')
    expect(apply('********', 4, 4, 'bold')).toBe('')
    expect(apply('****', 2, 2, 'italic')).toBe('******')
    expect(apply('******', 3, 3, 'italic')).toBe('****')
    expect(apply('******', 3, 3, 'bold')).toBe('**')
  })

  it('wraps and unwraps the word at an empty caret', () => {
    expect(apply('hello', 2, 2, 'bold')).toBe('**hello**')
    expect(apply('hello', 2, 2, 'bold', 2)).toBe('hello')
    expect(apply('say hello there', 6, 6, 'italic')).toBe('say *hello* there')
    expect(apply('say hello there', 6, 6, 'italic', 2)).toBe('say hello there')
  })

  it('toggles a mark from inside an already-formatted word', () => {
    expect(apply('**hello**', 4, 4, 'bold')).toBe('hello')
    expect(apply('**hello**', 4, 4, 'italic')).toBe('***hello***')
    expect(apply('***hello***', 5, 5, 'bold')).toBe('*hello*')
  })

  it('toggles every inline mark the same way', () => {
    const marks: FormatAction[] = ['bold', 'italic', 'underline', 'strike', 'code', 'highlight']
    for (const mark of marks) {
      expect(apply('word', 0, 4, mark, 2)).toBe('word')
      expect(apply('word', 2, 2, mark, 2)).toBe('word')
    }
  })

  it('keeps a link and toggles marks on its label', () => {
    expect(apply('[hello](https://x.com)', 0, 22, 'bold')).toBe('[**hello**](https://x.com)')
    expect(apply('[**hello**](https://x.com)', 0, 26, 'bold')).toBe('[hello](https://x.com)')
    expect(apply('[hello](https://x.com)', 1, 6, 'bold')).toBe('[**hello**](https://x.com)')
  })

  it('toggles line styles instead of stacking prefixes', () => {
    expect(apply('hello', 0, 5, 'heading')).toBe('## hello')
    expect(apply('hello', 0, 5, 'heading', 2)).toBe('hello')
    expect(apply('hello', 0, 5, 'list', 2)).toBe('hello')
    expect(apply('hello', 0, 5, 'quote', 2)).toBe('hello')
    expect(apply('## hello', 0, 8, 'heading')).toBe('hello')
    expect(apply('- hello', 0, 7, 'list')).toBe('hello')
  })

  it('swaps highlight colour without nesting ==', () => {
    const view = viewWith('=={rose}hi==', 0, 12)
    applyHighlight(view, 'sky')
    expect(view.state.doc.toString()).toBe('=={sky}hi==')
    applyHighlight(view, 'sky')
    expect(view.state.doc.toString()).toBe('hi')
    view.destroy()
  })
})
