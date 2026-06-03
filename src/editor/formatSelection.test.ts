import { describe, expect, it } from 'vitest'
import { buildInline, parseInlineMarks, parseLink } from './formatSelection'

describe('parseInlineMarks', () => {
  it('peels a single wrapped span', () => {
    expect(parseInlineMarks('**bold**')).toEqual({
      plain: 'bold',
      marks: { bold: true, italic: false, strike: false, code: false },
    })
    expect(parseInlineMarks('*ital*').marks.italic).toBe(true)
    expect(parseInlineMarks('~~struck~~').marks.strike).toBe(true)
    expect(parseInlineMarks('`code`').marks.code).toBe(true)
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
      marks: { bold: true, italic: false, strike: false, code: false },
    })
  })

  // Regression: the old `startsWith && endsWith` check mis-peeled these and
  // corrupted the document on re-wrap (dangling markers).
  it('does NOT peel multiple spans that merely share an outer delimiter', () => {
    expect(parseInlineMarks('**a** and **b**').marks.bold).toBe(false)
    expect(parseInlineMarks('*a* *b*').marks.italic).toBe(false)
    expect(parseInlineMarks('`a` `b`').marks.code).toBe(false)
    expect(parseInlineMarks('~~a~~ ~~b~~').marks.strike).toBe(false)
  })

  it('leaves bare or unbalanced markers untouched', () => {
    expect(parseInlineMarks('***').plain).toBe('***')
    expect(parseInlineMarks('plain text').marks).toEqual({
      bold: false,
      italic: false,
      strike: false,
      code: false,
    })
  })
})

describe('buildInline', () => {
  it('round-trips a clean span back to plain when toggled off', () => {
    const { plain, marks } = parseInlineMarks('**word**')
    expect(buildInline(plain, { ...marks, bold: false })).toBe('word')
  })

  it('rebuilds combined marks deterministically', () => {
    expect(buildInline('x', { bold: true, italic: true, strike: false, code: false })).toBe('***x***')
    // Strike is the innermost wrapper, bold/italic wrap around it.
    expect(buildInline('x', { bold: true, italic: false, strike: true, code: false })).toBe('**~~x~~**')
  })

  it('code wins over other marks', () => {
    expect(buildInline('x', { bold: true, italic: true, strike: true, code: true })).toBe('`x`')
  })

  it('returns empty for empty input', () => {
    expect(buildInline('', { bold: true, italic: false, strike: false, code: false })).toBe('')
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
