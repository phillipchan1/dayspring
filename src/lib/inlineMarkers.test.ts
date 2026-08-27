import { describe, expect, it } from 'vitest'
import { stripInlineMarkers, stripLineMarkers, stripMarkdownMarkers } from './inlineMarkers'

describe('stripInlineMarkers', () => {
  it('removes paired markers and keeps the words', () => {
    expect(stripInlineMarkers('a **bold** b')).toBe('a bold b')
    expect(stripInlineMarkers('a *ital* b')).toBe('a ital b')
    expect(stripInlineMarkers('a ~~gone~~ b')).toBe('a gone b')
    expect(stripInlineMarkers('a `code` b')).toBe('a code b')
    expect(stripInlineMarkers('a ==hl== b')).toBe('a hl b')
    expect(stripInlineMarkers('==hl ==')).toBe('hl ')
    expect(stripInlineMarkers('a =={rose}hl== b')).toBe('a hl b')
    expect(stripInlineMarkers('a ++under++ b')).toBe('a under b')
  })

  // The whole reason this isn't a character class. A naive /[=+]/g strip turns
  // the first into "224" and the second into "C".
  it('leaves unpaired punctuation in ordinary prose alone', () => {
    expect(stripInlineMarkers('2+2=4')).toBe('2+2=4')
    expect(stripInlineMarkers('I still write C++ sometimes')).toBe('I still write C++ sometimes')
    expect(stripInlineMarkers('a * b')).toBe('a * b')
    expect(stripInlineMarkers('x == y')).toBe('x == y')
    expect(stripInlineMarkers('1 ++ 2')).toBe('1 ++ 2')
    expect(stripInlineMarkers('5 > 3')).toBe('5 > 3')
  })

  it('collapses a link to its label', () => {
    expect(stripInlineMarkers('see [the docs](https://x.com) now')).toBe('see the docs now')
  })

  // An image is not prose. Leaving the bang behind puts a character on the page
  // that the writer never typed.
  it('drops an image whole, bang included', () => {
    expect(stripInlineMarkers('before ![the lake](a.png) after')).toBe('before the lake after')
    expect(stripInlineMarkers('![](a.png)')).toBe('')
  })

  it('handles several spans on one line', () => {
    expect(stripInlineMarkers('==a== and ==b==')).toBe('a and b')
    expect(stripInlineMarkers('**a** and **b**')).toBe('a and b')
  })

  it('unwraps nested marks', () => {
    expect(stripInlineMarkers('=={sky}**both**==')).toBe('both')
  })
})

describe('stripLineMarkers', () => {
  it('removes line prefixes only', () => {
    expect(stripLineMarkers('## Heading')).toBe('Heading')
    expect(stripLineMarkers('> quoted')).toBe('quoted')
    expect(stripLineMarkers('- item')).toBe('item')
    expect(stripLineMarkers('3. item')).toBe('item')
  })

  it('does not touch a mid-sentence arrow', () => {
    expect(stripLineMarkers('faith > fear')).toBe('faith > fear')
  })
})

describe('stripMarkdownMarkers', () => {
  it('does both passes', () => {
    expect(stripMarkdownMarkers('# =={rose}**Morning**==')).toBe('Morning')
  })
})
