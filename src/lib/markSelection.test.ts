import { describe, expect, it } from 'vitest'
import { canMarkExistingLines, wrapLinesInFence } from './markSelection'
import { formatSpiritualBlock, parseSpiritualBlocks } from './spiritualBlocks'

const ID = '0123abcd-0123-0123-0123-0123456789ab'

describe('wrapLinesInFence', () => {
  const DOC = 'Tuesday\n\nDown to the water while it was still dark.\n\nWalked back the long way.'

  it('grows a mid-sentence selection out to whole lines', () => {
    const at = DOC.indexOf('water')
    const wrap = wrapLinesInFence(DOC, at, at + 5, 'gift', ID)!
    expect(wrap.content).toBe('Down to the water while it was still dark.')
    expect(DOC.slice(wrap.from, wrap.to)).toBe(wrap.content)
  })

  it('produces a fence the parser reads back as the same kind and words', () => {
    const at = DOC.indexOf('Walked')
    const wrap = wrapLinesInFence(DOC, at, at + 6, 'learned', ID)!
    const next = DOC.slice(0, wrap.from) + wrap.insert + DOC.slice(wrap.to)
    expect(parseSpiritualBlocks(next)[0]).toMatchObject({
      type: 'learned',
      id: ID,
      content: 'Walked back the long way.',
    })
  })

  it('marks a caret’s own line when nothing is selected', () => {
    const at = DOC.indexOf('still')
    const wrap = wrapLinesInFence(DOC, at, at, 'sense', ID)!
    expect(wrap.content).toBe('Down to the water while it was still dark.')
  })

  it('carries a multi-line selection whole', () => {
    const doc = 'one\ntwo\nthree'
    const wrap = wrapLinesInFence(doc, 1, doc.indexOf('three') + 2, 'story', ID)!
    expect(wrap.content).toBe('one\ntwo\nthree')
  })

  // A drag that overshoots into the gap between paragraphs should mark the
  // paragraph, not the gap.
  it('trims blank lines off both ends', () => {
    const doc = 'first\n\nmiddle\n\nlast'
    const wrap = wrapLinesInFence(doc, doc.indexOf('first') + 5, doc.indexOf('last'), 'gift', ID)!
    expect(wrap.content).toBe('first\n\nmiddle\n\nlast'.slice(0, wrap.to - wrap.from))
    expect(wrap.content.startsWith('first')).toBe(true)
    expect(wrap.content.endsWith('last')).toBe(true)
  })

  it('refuses a selection of nothing but blank lines', () => {
    const doc = 'a\n\n\n\nb'
    expect(wrapLinesInFence(doc, 2, 4, 'gift', ID)).toBeNull()
  })

  // A fence inside a fence is not a document anyone can edit back out of.
  it('refuses to mark a marking', () => {
    const doc = `before\n${formatSpiritualBlock('prayer', ID, 'for Dad')}\nafter`
    const at = doc.indexOf('for Dad')
    expect(wrapLinesInFence(doc, at, at + 7, 'gift', ID)).toBeNull()
  })

  it('refuses a range that merely touches a marking', () => {
    const doc = `${formatSpiritualBlock('prayer', ID, 'for Dad')}\nafter`
    expect(wrapLinesInFence(doc, 0, doc.length, 'gift', ID)).toBeNull()
  })

  // The token lines carry a ritual's structure and are not the writer's words.
  it('refuses to mark a practice’s hidden tokens', () => {
    const doc = 'before\n<!-- ritual:section:Gratitude -->\nan answer'
    expect(wrapLinesInFence(doc, 0, doc.length, 'gift', ID)).toBeNull()
  })

  it('clamps a range that runs past the document', () => {
    const wrap = wrapLinesInFence('only line', 0, 9999, 'story', ID)!
    expect(wrap.content).toBe('only line')
    expect(wrap.to).toBe(9)
  })
})

describe('canMarkExistingLines', () => {
  // Scripture's words are not the writer's own — there is nothing on the page
  // to wrap, because the verse arrives verbatim from the ESV by reference.
  it('is true for every kind but scripture', () => {
    expect(canMarkExistingLines('scripture')).toBe(false)
    for (const kind of ['gift', 'prayer', 'desire', 'sense', 'learned', 'story', 'absence'] as const) {
      expect(canMarkExistingLines(kind)).toBe(true)
    }
  })
})
