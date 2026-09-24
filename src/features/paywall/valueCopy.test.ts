import { describe, expect, it } from 'vitest'
import { FEATURES, SERVICE_BULLETS, shouldShowGrantedCountdown } from './valueCopy'

describe('subscription packaging', () => {
  it('sells services, not named module unlocks', () => {
    const blob = [...FEATURES, ...SERVICE_BULLETS].join(' ').toLowerCase()
    expect(blob).toMatch(/sync/)
    expect(blob).toMatch(/backup/)
    expect(blob).toMatch(/rituals/)
    expect(blob).not.toMatch(/ascent|altar|lamp/)
    expect(blob).not.toMatch(/unlock/)
  })

  it('hides a year-long complimentary-looking countdown', () => {
    expect(shouldShowGrantedCountdown(14)).toBe(true)
    expect(shouldShowGrantedCountdown(1)).toBe(true)
    expect(shouldShowGrantedCountdown(0)).toBe(false)
    expect(shouldShowGrantedCountdown(359)).toBe(false)
  })
})
