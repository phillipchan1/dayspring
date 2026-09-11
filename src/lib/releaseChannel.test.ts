import { describe, expect, it } from 'vitest'
import { allowsInternalUi } from './releaseChannel'

describe('allowsInternalUi', () => {
  it('allows internal surfaces only in explicitly alpha builds', () => {
    expect(allowsInternalUi('alpha')).toBe(true)
    expect(allowsInternalUi('appstore')).toBe(false)
    expect(allowsInternalUi('stable')).toBe(false)
    expect(allowsInternalUi(undefined)).toBe(false)
  })
})
