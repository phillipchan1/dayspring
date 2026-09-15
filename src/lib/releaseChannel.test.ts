import { describe, expect, it } from 'vitest'
import { allowsInternalUi, isAppStoreRelease } from './releaseChannel'

describe('allowsInternalUi', () => {
  it('allows internal surfaces only in explicitly alpha builds', () => {
    expect(allowsInternalUi('alpha')).toBe(true)
    expect(allowsInternalUi('appstore')).toBe(false)
    expect(allowsInternalUi('stable')).toBe(false)
    expect(allowsInternalUi(undefined)).toBe(false)
  })
})

describe('isAppStoreRelease', () => {
  it('matches only the production iOS channel', () => {
    expect(isAppStoreRelease('appstore')).toBe(true)
    expect(isAppStoreRelease('alpha')).toBe(false)
    expect(isAppStoreRelease(undefined)).toBe(false)
  })
})
