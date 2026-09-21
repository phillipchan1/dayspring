import { describe, expect, it } from 'vitest'
import { isOnPage } from './refrainCheck'

describe('isOnPage', () => {
  it('finds the words in the visible page, markers and spacing aside', () => {
    expect(isOnPage('Never force anything.', 'Some morning.\n\n**Never force** anything. Then coffee.')).toBe(true)
    expect(isOnPage('I didn’t know.', "I didn't know.")).toBe(true)
  })
  it('refuses words that are not on the page', () => {
    expect(isOnPage('Never force anything.', 'Force nothing, maybe.')).toBe(false)
    expect(isOnPage('', 'anything')).toBe(false)
  })
})
