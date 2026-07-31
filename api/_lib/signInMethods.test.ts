import { describe, it, expect } from 'vitest'
import { crossAccountMessage } from './signInMethods'

describe('crossAccountMessage', () => {
  it('names the single provider and the button to press', () => {
    const msg = crossAccountMessage(['google'])
    expect(msg).toContain('signs in with Google')
    expect(msg).toContain('"Continue with Google"')
  })

  it('lists both providers without pretending to know which one they used', () => {
    const msg = crossAccountMessage(['google', 'apple'])
    expect(msg).toContain('Google or Apple')
    expect(msg).toContain('the button you used when you subscribed')
  })

  it('still says something useful when the lookup found nothing', () => {
    const msg = crossAccountMessage([])
    expect(msg).toContain('belongs to a different Dayspring account')
    expect(msg).not.toContain('undefined')
  })

  it('ignores providers it has no label for', () => {
    expect(crossAccountMessage(['github'])).toBe(crossAccountMessage([]))
  })

  // The caller proved they hold the App Store subscription — not that they own
  // the account it sits on. The provider is the most we may disclose.
  it('never leaks anything but the provider name', () => {
    const msg = crossAccountMessage(['google', 'apple'])
    expect(msg).not.toMatch(/@/)
  })
})
