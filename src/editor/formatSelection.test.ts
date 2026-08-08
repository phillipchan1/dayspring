import { describe, expect, it } from 'vitest'
import {
  buildInline,
  EMPTY_INLINE,
  parseInlineMarks,
  parseLink,
  toggleHighlight,
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

  it('leaves bare or unbalanced markers untouched', () => {
    expect(parseInlineMarks('***').plain).toBe('***')
    expect(parseInlineMarks('plain text').marks).toEqual(EMPTY_INLINE)
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

  it('returns empty for empty input', () => {
    expect(buildInline('', { ...EMPTY_INLINE, bold: true })).toBe('')
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
