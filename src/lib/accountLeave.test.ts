import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { leftAccount } from './accountLeave'

describe('leaving an account', () => {
  it('is signing out, or being signed out', () => {
    expect(leftAccount('user-a', null)).toBe(true)
  })

  it('is another account taking over', () => {
    expect(leftAccount('user-a', 'user-b')).toBe(true)
  })

  it('is not signing in, staying signed in, or staying a guest', () => {
    expect(leftAccount(null, 'user-a')).toBe(false)
    expect(leftAccount('user-a', 'user-a')).toBe(false)
    expect(leftAccount(null, null)).toBe(false)
  })
})

/**
 * Source tripwires, as App.guestPath.test.ts does: the restart is what keeps
 * one account's journal out of the next owner's cache, and nothing else in the
 * suite would notice it quietly going missing.
 */
describe('the app restarts when an account is left', () => {
  const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')

  it('scrubs, then reloads, and never mounts the guest shell in between', () => {
    expect(app).toMatch(/leftAccount\(/)
    expect(app).toMatch(/purgeOnSignOut\(\)/)
    expect(app).toMatch(/window\.location\.reload\(\)/)
    // The loader is returned for a left account before the `!session` branch
    // that mounts GuestApp — its fence would claim the cache for the guest
    // while the old session's work could still refill it.
    expect(app.indexOf('if (left)')).toBeGreaterThan(-1)
    expect(app.indexOf('if (left)')).toBeLessThan(app.indexOf('<GuestApp />'))
  })

  it('leaves account deletion to finish its own scrub', () => {
    const account = readFileSync(resolve(__dirname, 'account.ts'), 'utf8')
    expect(account).toMatch(/claimRestart\(\)/)
    expect(account.indexOf('claimRestart()')).toBeLessThan(account.indexOf('await sb.auth.signOut()'))
  })
})
