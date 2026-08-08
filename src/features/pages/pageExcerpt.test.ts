import { describe, expect, it } from 'vitest'
import { pageExcerpt, pageFill, splitOnMatch } from './pageExcerpt'
import { EXCERPT_MAX_LINES } from './zoom'

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

  // Highlight and underline shipped after this module did, and its own local
  // stripper had never heard of them — a highlighted sentence rendered on a card
  // as literal `==like this==`.
  it('unwraps highlight and underline too', () => {
    expect(pageExcerpt(entry('the ==thing he said== to me')).lines[0]!.text).toBe(
      'the thing he said to me',
    )
    expect(pageExcerpt(entry('the =={rose}thing he said== to me')).lines[0]!.text).toBe(
      'the thing he said to me',
    )
    expect(pageExcerpt(entry('I ++underlined++ that')).lines[0]!.text).toBe('I underlined that')
  })

  // The reason the shared stripper is pair-aware rather than a character class.
  it('leaves unpaired punctuation in prose alone', () => {
    expect(pageExcerpt(entry('I still write C++ sometimes')).lines[0]!.text).toBe(
      'I still write C++ sometimes',
    )
    expect(pageExcerpt(entry('2+2=4 is still true')).lines[0]!.text).toBe('2+2=4 is still true')
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

  // `total` and `chars` describe the ENTRY; `lines` is only what was kept. That
  // separation is what lets a card slice the excerpt for its own zoom level and
  // still know whether it stopped short.
  it('counts the whole entry, not the excerpt it kept', () => {
    const body = Array.from({ length: 20 }, (_, i) => `line number ${i} of the entry`).join('\n\n')
    const x = pageExcerpt(entry(body), [], 3)
    expect(x.lines).toHaveLength(3)
    expect(x.total).toBe(20)
    expect(x.chars).toBeGreaterThan(x.lines.reduce((n, l) => n + l.text.length, 0))
  })

  it('builds to the shared ceiling by default, so any zoom level can slice it', () => {
    const body = Array.from({ length: 40 }, (_, i) => `line number ${i} of the entry`).join('\n\n')
    const x = pageExcerpt(entry(body))
    expect(x.lines).toHaveLength(EXCERPT_MAX_LINES)
    expect(x.total).toBe(40)
  })

  it('is empty for an empty body', () => {
    const x = pageExcerpt(entry(''))
    expect(x.lines).toEqual([])
    expect(x.chars).toBe(0)
    expect(x.total).toBe(0)
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

describe('pageExcerpt with a lit subject', () => {
  const body = [
    'A quiet opening sentence about the weather',
    'Another line that is not about anything in particular',
    'The line where Chicago actually comes up',
  ].join('\n\n')

  /**
   * The point of the whole thing: a page that lights up should show you WHY.
   * Without this you are told a page is about Chicago and handed its opening
   * sentence about the weather, and have to open it to find out.
   */
  it('shows the line that made the page light up, not the opening line', () => {
    const x = pageExcerpt(entry(body), [], 1, /(?<![a-z0-9])(chicago)(?![a-z0-9])/gi)
    expect(x.lines[0]!.text).toContain('Chicago')
    expect(x.lines[0]!.hit).toBe(true)
  })

  it('keeps the rest of the page after the matches, in its own order', () => {
    const x = pageExcerpt(entry(body), [], 9, /(?<![a-z0-9])(chicago)(?![a-z0-9])/gi)
    expect(x.lines.map((l) => l.text)).toEqual([
      'The line where Chicago actually comes up',
      'A quiet opening sentence about the weather',
      'Another line that is not about anything in particular',
    ])
  })

  it('leaves the page in its own order when nothing matches', () => {
    const x = pageExcerpt(entry(body), [], 9, /(?<![a-z0-9])(reykjavik)(?![a-z0-9])/gi)
    expect(x.lines[0]!.text).toContain('quiet opening')
    expect(x.lines.every((l) => !l.hit)).toBe(true)
  })
})

describe('splitOnMatch', () => {
  it('alternates plain and matched runs', () => {
    expect(splitOnMatch('a Chicago b', /chicago/gi)).toEqual(['a ', 'Chicago', ' b'])
  })

  it('handles a line that is nothing but the match', () => {
    expect(splitOnMatch('Chicago', /chicago/gi)).toEqual(['', 'Chicago', ''])
  })

  it('handles several matches on one line', () => {
    expect(splitOnMatch('Chicago then Chicago', /chicago/gi)).toEqual([
      '', 'Chicago', ' then ', 'Chicago', '',
    ])
  })

  it('is the whole line when nothing is lit', () => {
    expect(splitOnMatch('anything', null)).toEqual(['anything'])
  })

  // A zero-width pattern would otherwise spin forever on one index.
  it('terminates on a pattern that can match nothing', () => {
    expect(splitOnMatch('abc', /x*/g).join('')).toBe('abc')
  })
})
