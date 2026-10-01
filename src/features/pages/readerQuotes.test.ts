// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { drawReaderQuotes } from './readerQuotes'

function page(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

const PASSAGE =
  '<figure class="read-scripture"><p>Remain in me, and I in you. I am the vine. You are the branches.</p></figure>'

describe('drawn quotes in the reader', () => {
  it('lights each quote’s words in the passage, and tags its verse', () => {
    const el = page(`${PASSAGE}<blockquote><p>I am the vine (v. 5)</p></blockquote><p>Mine.</p>`)
    drawReaderQuotes(el, true)
    expect(el.querySelector('mark.read-drawn')?.textContent).toBe('I am the vine')
    expect(el.querySelector('.read-quote__v')?.textContent).toBe('v. 5')
    expect(el.querySelector('blockquote')?.textContent).toBe('I am the vinev. 5')
  })

  it('follows a quote from either end', () => {
    const el = page(`${PASSAGE}<blockquote><p>Remain in me (v. 4)</p></blockquote>`)
    drawReaderQuotes(el, true)
    const bq = el.querySelector('blockquote')!
    bq.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.querySelector('mark.read-drawn')?.classList.contains('is-lit')).toBe(true)
    bq.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.querySelector('mark.read-drawn')?.classList.contains('is-lit')).toBe(false)
  })

  it('leaves an ordinary page’s quotes alone', () => {
    const el = page('<blockquote><p>A friend said: go gently.</p></blockquote>')
    drawReaderQuotes(el, false)
    expect(el.querySelector('blockquote')?.classList.contains('read-quote')).toBe(false)
  })
})
