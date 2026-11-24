import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

describe('alpha desktop identity', () => {
  it('patches a private bundle id and URL scheme only in the alpha workflow', () => {
    const alpha = readFileSync(resolve(__dirname, '../../.github/workflows/release.yml'), 'utf8')
    const stable = readFileSync(resolve(__dirname, '../../.github/workflows/release-stable.yml'), 'utf8')
    expect(alpha).toMatch(/com\.phillipchan\.dayspring\.alpha/)
    expect(alpha).toMatch(/dayspring-alpha/)
    expect(alpha).toMatch(/VITE_RELEASE_CHANNEL: alpha/)
    expect(stable).not.toMatch(/dayspring-alpha/)
    expect(stable).not.toMatch(/com\.phillipchan\.dayspring\.alpha/)
  })

  it('sends dayspring-alpha to the Worker from alpha desktop builds', () => {
    const client = readFileSync(resolve(__dirname, './authClient.ts'), 'utf8')
    expect(client).toMatch(/VITE_RELEASE_CHANNEL === 'alpha' \? 'dayspring-alpha' : 'dayspring'/)
  })
})
