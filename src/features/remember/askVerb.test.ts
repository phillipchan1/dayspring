import { describe, expect, it } from 'vitest'
import { guessVerb, shouldOfferAsk } from './askVerb'

describe('guessVerb', () => {
  it('treats bare terms and names as Find', () => {
    expect(guessVerb('NQ')).toBe('find')
    expect(guessVerb('Esther')).toBe('find')
    expect(guessVerb('prop account')).toBe('find')
    expect(guessVerb('Psalm 27')).toBe('find')
  })

  it('treats questions about oneself as Ask', () => {
    expect(guessVerb('have I ever felt this before')).toBe('ask')
    expect(guessVerb('tell me every time I talked about trading')).toBe('ask')
    expect(guessVerb('what was I praying about when dad got sick')).toBe('ask')
  })

  it('reads a trailing question mark as Ask regardless of length', () => {
    expect(guessVerb('why?')).toBe('ask')
  })

  it('defaults an empty query to Find', () => {
    expect(guessVerb('')).toBe('find')
    expect(guessVerb('   ')).toBe('find')
  })

  it('does not fire on a long noun phrase without a verb', () => {
    expect(guessVerb('Esther')).toBe('find')
    expect(guessVerb('the desk')).toBe('find')
  })
})

describe('shouldOfferAsk', () => {
  it('offers Ask when a multi-word query finds nothing', () => {
    expect(shouldOfferAsk('felt like this')).toBe(true)
  })

  it('stays quiet for a single word — a typo should not cost a model call', () => {
    expect(shouldOfferAsk('xylophone')).toBe(false)
    expect(shouldOfferAsk('NQ')).toBe(false)
  })

  it('stays quiet for a near-empty query', () => {
    expect(shouldOfferAsk('a')).toBe(false)
  })
})
