import { describe, expect, it } from 'vitest'
import { pageExcerpt, pageFill } from './pageExcerpt'

const entry = (body: string) => ({
  id: 'e1',
  created_at: '2020-05-04T12:00:00Z',
  body_markdown: body,
})

describe('pageExcerpt', () => {
  it('returns verbatim prose with the markdown scaffolding removed', () => {
    const x = pageExcerpt(entry('# A heading\n\n- a bullet point here\n\n> a quoted line of text'))
    expect(x.lines.map((l) => l.text)).toEqual([
      'A heading',
      'a bullet point here',
      'a quoted line of text',
    ])
  })

  it('unwraps inline emphasis rather than showing the markers', () => {
    const x = pageExcerpt(entry('I was **completely undone** by it'))
    expect(x.lines[0]!.text).toBe('I was completely undone by it')
  })

  it('marks a blockquote as set apart', () => {
    const x = pageExcerpt(entry('> He has been faithful in every one of these years'))
    expect(x.lines[0]!.set).toBe(true)
  })

  it('marks a bolded complete sentence as set apart', () => {
    const x = pageExcerpt(entry('**He met me in the middle of that week.**'))
    expect(x.lines[0]!.set).toBe(true)
  })

  it('leaves ordinary prose unset', () => {
    const x = pageExcerpt(entry('Ordinary sentence about the weather today'))
    expect(x.lines[0]!.set).toBe(false)
  })

  it('lights a line covered by a mark from the marks table', () => {
    const line = 'This is the sentence I chose to keep for later'
    const x = pageExcerpt(entry(line), [line])
    expect(x.lines[0]!.set).toBe(true)
  })

  it('does not light a short line on a coincidental substring', () => {
    const x = pageExcerpt(entry('the day'), ['the day was long and full of small mercies'])
    expect(x.lines[0]!.set).toBe(false)
  })

  it('strips spiritual blocks, so a scripture insert never becomes prose', () => {
    const body = [
      'Real writing here',
      '```dayspring-scripture 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'He will keep your going out and your coming in',
      'Psalm 121:8',
      '```',
    ].join('\n')
    const x = pageExcerpt(entry(body))
    expect(x.lines.map((l) => l.text)).toEqual(['Real writing here'])
  })

  it('reports truncation and counts the whole entry, not the excerpt', () => {
    const body = Array.from({ length: 20 }, (_, i) => `line number ${i} of the entry`).join('\n\n')
    const x = pageExcerpt(entry(body), [], 3)
    expect(x.lines).toHaveLength(3)
    expect(x.truncated).toBe(true)
    expect(x.chars).toBeGreaterThan(x.lines.reduce((n, l) => n + l.text.length, 0))
  })

  it('is empty for an empty body', () => {
    const x = pageExcerpt(entry(''))
    expect(x.lines).toEqual([])
    expect(x.chars).toBe(0)
    expect(x.truncated).toBe(false)
  })
})

describe('pageFill', () => {
  it('is zero for nothing written', () => {
    expect(pageFill(0)).toBe(0)
  })

  it('grows with length and never exceeds a full page', () => {
    expect(pageFill(100)).toBeGreaterThan(pageFill(40))
    expect(pageFill(1000)).toBeGreaterThan(pageFill(100))
    expect(pageFill(50_000)).toBe(1)
  })

  it('separates a short day from a long one well before saturating', () => {
    expect(pageFill(400) - pageFill(40)).toBeGreaterThan(0.2)
  })
})
