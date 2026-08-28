// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import type { PageMarking } from '@/lib/spiritual'
import type { SpiritualItemType } from '@/lib/types'
import { drawMarkings, flatten, sortMarkings } from './pageMarkings'

let n = 0
function marking(content: string, type: SpiritualItemType = 'prayer'): PageMarking {
  return { id: `m${++n}`, entryId: 'e1', type, content, declared: false }
}

describe('flatten', () => {
  // Both sides have to be flattened the same way: the stored sentence is raw
  // markdown and the rendered page is not.
  it('unwraps markers rather than deleting the words inside them', () => {
    expect(flatten('**that morning** I asked')).toBe('that morning i asked')
    expect(flatten('==held it== lightly')).toBe('held it lightly')
  })

  // The writer's keyboard and the importer's disagree about apostrophes, and
  // neither of them meant anything by it.
  it('folds curly quotes, which are an accident of the keyboard', () => {
    expect(flatten('I couldn’t say')).toBe(flatten("I couldn't say"))
  })

  it('collapses the whitespace a paragraph break leaves behind', () => {
    expect(flatten('one\n\n  two   three')).toBe('one two three')
  })
})

describe('sortMarkings', () => {
  const body = [
    'Tiffany called this morning and we prayed about the move.',
    '',
    'I asked Him to make the way plain before Thursday.',
  ].join('\n')

  it('places a marking the page actually says', () => {
    const m = marking('I asked Him to make the way plain before Thursday.')
    expect(sortMarkings(body, [m]).inProse).toEqual([m])
  })

  /*
   * A typed `/pray` is stripped from the prose by `entryContentLines` and from
   * the rendered page by `stripSpiritualBlocks`, so it is correctly never
   * found. It is not missing — it is its own thing, and the margin is where it
   * goes.
   */
  it('leaves a declared block loose, because it is not in the prose', () => {
    // A real fence: the opener carries a uuid, or the parser does not see it.
    const declared =
      '```dayspring-pray 7f3b1c22-9a4e-4d51-8b0f-2c6ad5e91b40\n' +
      'For my father, that he would sleep.\n```'
    const m = { ...marking('For my father, that he would sleep.'), declared: true }
    const { inProse, loose } = sortMarkings(`${body}\n\n${declared}`, [m])
    expect(inProse).toEqual([])
    expect(loose).toEqual([m])
  })

  // The same floor `isSetApart` uses. A six-character needle is in half the
  // paragraphs on the page, and a marking placed at random is worse than one
  // in the margin.
  it('will not place a sentence short enough to match by accident', () => {
    expect(sortMarkings(body, [marking('the move')]).loose).toHaveLength(1)
  })

  it('matches across the markers the writer wrapped it in', () => {
    const m = marking('we prayed about the move')
    const emphasised = 'Tiffany called this morning and **we prayed about the move**.'
    expect(sortMarkings(emphasised, [m]).inProse).toEqual([m])
  })
})

describe('drawMarkings', () => {
  function page(html: string): HTMLElement {
    const el = document.createElement('div')
    el.innerHTML = html
    return el
  }

  it('marks the block carrying the sentence, and only that one', () => {
    const el = page('<p>Nothing here.</p><p>I asked Him to make the way plain.</p>')
    const m = marking('I asked Him to make the way plain.')
    expect(drawMarkings(el, [m])).toEqual(new Set(['m' + n]))
    const ps = el.querySelectorAll('p')
    expect(ps[0]!.hasAttribute('data-marking')).toBe(false)
    expect(ps[1]!.getAttribute('data-marking')).toBe('prayer')
  })

  /*
   * The smallest block, not the first. A paragraph inside a blockquote contains
   * the sentence and so does the blockquote, and marking the quote would claim
   * the whole of it for one line inside it.
   */
  it('picks the innermost block when several contain the sentence', () => {
    const el = page(
      '<blockquote><p>Something else entirely, at length.</p>' +
        '<p>I asked Him to make the way plain.</p></blockquote>',
    )
    drawMarkings(el, [marking('I asked Him to make the way plain.')])
    expect(el.querySelector('blockquote')?.hasAttribute('data-marking')).toBe(false)
    expect(el.querySelectorAll('p')[1]!.getAttribute('data-marking')).toBe('prayer')
  })

  it('names both kinds when one sentence carries two', () => {
    const line = 'I asked Him to make the way plain.'
    const el = page(`<p>${line}</p>`)
    drawMarkings(el, [marking(line, 'prayer'), marking(line, 'desire')])
    const p = el.querySelector('p')!
    expect(p.getAttribute('data-marking')).toBe('prayer desire')
    expect(p.getAttribute('aria-label')).toBe('Prayer · Desire')
    // One rule, not two stacked — it says "marked", the label says by what.
    expect(p.style.getPropertyValue('--mark-tone')).toBe('var(--accent)')
  })

  /*
   * The hand IS the label — the same rule the editor's margin works by. A flat
   * coloured rule would say "something is marked here" and make the reader look
   * up which; the kind's own drawing says which before a word is read.
   */
  it('hangs the kind\u2019s own hand in the gutter, once', () => {
    const line = 'I asked Him to make the way plain.'
    const el = page(`<p>${line}</p>`)
    drawMarkings(el, [marking(line, 'scripture')])
    const hands = el.querySelectorAll('.pg-read1__hand')
    expect(hands).toHaveLength(1)
    expect(hands[0]!.className).toContain('ds-glyph--scripture')
    // Drawn ahead of the words, so it hangs beside the first line of them.
    expect(el.querySelector('p')!.firstElementChild).toBe(hands[0])
  })

  // The reader re-runs this on every paint of the page; a second pass must not
  // leave a second hand in the margin.
  it('does not stack a second hand when it runs again', () => {
    const line = 'I asked Him to make the way plain.'
    const el = page(`<p>${line}</p>`)
    drawMarkings(el, [marking(line, 'prayer')])
    drawMarkings(el, [marking(line, 'prayer')])
    expect(el.querySelectorAll('.pg-read1__hand')).toHaveLength(1)
  })

  it('places nothing, and breaks nothing, when the sentence is not there', () => {
    const el = page('<p>Nothing here.</p>')
    const before = el.innerHTML
    expect(drawMarkings(el, [marking('I asked Him to make the way plain.')]).size).toBe(0)
    expect(el.innerHTML).toBe(before)
  })
})
