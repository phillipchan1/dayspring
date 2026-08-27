// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

// renderMarkdown feeds the print window. `asTitle: false` keeps these focused on
// the inline extensions rather than the first-line-as-heading promotion.
const render = (md: string) => renderMarkdown(md, { asTitle: false })

describe('renderMarkdown — highlight', () => {
  it('renders a bare == as an amber mark', () => {
    expect(render('a ==word== b')).toContain('<mark class="hl hl--amber">word</mark>')
  })

  it('carries the named colour through DOMPurify', () => {
    // If a future DOMPurify tightens ALLOWED_ATTR, this fails loudly instead of
    // every printed highlight quietly turning grey.
    expect(render('a =={rose}word== b')).toContain('<mark class="hl hl--rose">word</mark>')
  })

  it('parses inline marks inside the highlight', () => {
    const html = render('==**bold**==')
    expect(html).toContain('<mark class="hl hl--amber">')
    expect(html).toContain('<strong>bold</strong>')
  })

  // Must agree with the editor's grammar (markdownMarks.ts), or print disagrees
  // with what the writer saw.
  it('does not match spaced equals', () => {
    expect(render('a == b == c')).not.toContain('<mark')
  })

  it('renders a highlight that captured a trailing space', () => {
    expect(render('==word ==')).toContain('<mark class="hl hl--amber">word </mark>')
  })

  it('treats an unknown colour token as content', () => {
    const html = render('=={nope}word==')
    expect(html).toContain('hl--amber')
    expect(html).toContain('{nope}word')
  })
})

describe('renderMarkdown — underline', () => {
  it('renders ++ as a u element', () => {
    expect(render('a ++word++ b')).toContain('<u class="ul">word</u>')
  })

  it('does not match C++ prose', () => {
    expect(render('I write C++ and more C++ daily')).not.toContain('<u')
  })
})
