import { describe, expect, it } from 'vitest'
import { NOTICE_MIN_DELTA, NOTICE_MIN_TEXT, verbatimIn, worthNoticing } from './noticing'

const PAGE =
  'Down to the water while it was still dark. Just the sound of it.\n' +
  'The long way home is not a detour.'

describe('verbatimIn', () => {
  it('keeps a proposal whose words are still on the page', () => {
    expect(verbatimIn(PAGE, [{ quote: 'The long way home is not a detour.', kind: 'learned' }])).toEqual([
      { id: 'learned:The long way home is not a detour.', kind: 'learned', quote: 'The long way home is not a detour.' },
    ])
  })

  /*
   * The server checked the text it was sent; by the time the answer arrives that
   * text is seconds old. A note pointing at a sentence the writer has since
   * deleted is the app quoting something nobody wrote — which is the one failure
   * this whole surface exists to avoid.
   */
  it('drops a proposal about words that are no longer there', () => {
    const edited = 'Down to the water while it was still dark.'
    expect(verbatimIn(edited, [{ quote: 'The long way home is not a detour.', kind: 'learned' }])).toEqual([])
  })

  it('drops a near-miss rather than matching the closest thing', () => {
    expect(verbatimIn(PAGE, [{ quote: 'the long way home is not a detour', kind: 'learned' }])).toEqual([])
  })

  it('drops a proposal with no quote or no kind', () => {
    expect(verbatimIn(PAGE, [{ kind: 'gift' }, { quote: 'Just the sound of it.' }])).toEqual([])
  })

  // The id is derived, never assigned: the same sentence proposed as the same
  // kind is the same proposal, so "not this" keeps holding across a re-ask.
  it('gives the same proposal the same identity every time', () => {
    const a = verbatimIn(PAGE, [{ quote: 'Just the sound of it.', kind: 'gift' }])[0]!
    const b = verbatimIn(PAGE, [{ quote: 'Just the sound of it.', kind: 'gift' }])[0]!
    expect(a.id).toBe(b.id)
  })
})

describe('worthNoticing', () => {
  const long = 'a sentence that is quite long. '.repeat(10)

  it('says no to a page too short to have anything on it', () => {
    expect('short'.length).toBeLessThan(NOTICE_MIN_TEXT)
    expect(worthNoticing('short', null)).toBe(false)
  })

  it('says yes the first time a page is long enough', () => {
    expect(worthNoticing(long, null)).toBe(true)
  })

  // A pause after fixing a typo is still a pause; asking again for it would
  // spend a model call to get the same notes back.
  it('says no to a pause that only fixed a typo', () => {
    expect(worthNoticing(`${long}x`, long)).toBe(false)
  })

  it('says yes once a real paragraph has been added', () => {
    expect(worthNoticing(long + 'y'.repeat(NOTICE_MIN_DELTA), long)).toBe(true)
  })

  it('says yes when a paragraph has been deleted, not only added', () => {
    const shorter = long.slice(0, long.length - NOTICE_MIN_DELTA)
    expect(worthNoticing(shorter, long)).toBe(true)
  })
})
