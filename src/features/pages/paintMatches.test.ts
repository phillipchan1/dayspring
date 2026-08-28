// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { paintMatches } from './paintMatches'
import { subjectMatcher, wordSubject } from './subjects'

/** The real matcher, so these test what the surface actually paints with. */
function matcherFor(word: string): RegExp {
  const s = wordSubject(word)
  const m = s ? subjectMatcher([s]) : null
  if (!m) throw new Error(`no matcher for ${word}`)
  return m
}

function body(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('paintMatches', () => {
  it('wraps the match and leaves the rest of the sentence alone', () => {
    const el = body('<p>I called Esther this morning.</p>')
    expect(paintMatches(el, matcherFor('Esther'), 'lit')).toBe(1)
    expect(el.querySelector('mark.lit')?.textContent).toBe('Esther')
    expect(el.textContent).toBe('I called Esther this morning.')
  })

  it('finds every occurrence, across separate elements', () => {
    const el = body('<p>Esther called.</p><blockquote>Esther again</blockquote>')
    expect(paintMatches(el, matcherFor('Esther'), 'lit')).toBe(2)
  })

  /*
   * The whole reason this walks text nodes instead of running the regex over
   * the HTML string. A subject is any word the writer types, and plenty of
   * ordinary words are also tag names and attribute names — "class" and "img"
   * both appear in the markup of a page that never says either.
   */
  it('cannot reach the markup, even when the subject is a tag or an attribute name', () => {
    const el = body('<p class="pgc__line"><img alt="x"> nothing here says it</p>')
    expect(paintMatches(el, matcherFor('class'), 'lit')).toBe(0)
    expect(paintMatches(el, matcherFor('img'), 'lit')).toBe(0)
    expect(el.querySelector('p')?.getAttribute('class')).toBe('pgc__line')
    expect(el.querySelectorAll('img')).toHaveLength(1)
  })

  it('preserves the writer’s own markup around a match', () => {
    const el = body('<p><strong>Esther</strong> and <em>Esther</em></p>')
    expect(paintMatches(el, matcherFor('Esther'), 'lit')).toBe(2)
    expect(el.querySelector('strong mark.lit')).not.toBeNull()
    expect(el.querySelector('em mark.lit')).not.toBeNull()
  })

  // Inside a code span the characters are a literal, not prose — the same rule
  // `facets.ts` follows when it reads content lines rather than raw markdown.
  it('leaves code alone', () => {
    const el = body('<p><code>esther()</code> but Esther here</p>')
    expect(paintMatches(el, matcherFor('Esther'), 'lit')).toBe(1)
    expect(el.querySelector('code')?.innerHTML).toBe('esther()')
  })

  it('matches whole words only, the way the wall does', () => {
    const el = body('<p>Esthers and Esther</p>')
    expect(paintMatches(el, matcherFor('Esther'), 'lit')).toBe(1)
  })

  it('paints nothing when nothing is lit', () => {
    const el = body('<p>Esther</p>')
    const before = el.innerHTML
    expect(paintMatches(el, null, 'lit')).toBe(0)
    expect(el.innerHTML).toBe(before)
  })

  /*
   * A stale matcher carries `lastIndex` from wherever it stopped last. The
   * cards hit this too (`splitOnMatch` resets it), and a reader painting a
   * second page with a half-advanced regex would silently miss the first
   * mention on it.
   */
  it('does not care where the matcher was left pointing', () => {
    const re = matcherFor('Esther')
    re.lastIndex = 40
    const el = body('<p>Esther, first thing.</p>')
    expect(paintMatches(el, re, 'lit')).toBe(1)
  })
})
