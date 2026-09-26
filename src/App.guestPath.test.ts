import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guideline 5.1.1(v): the unauthenticated cold path must reach the journal,
 * not SignIn. A source tripwire so the hard gate cannot silently return.
 */
describe('guest cold path', () => {
  it('App.tsx no longer hard-gates the journal behind SignIn', () => {
    const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8')
    expect(source).not.toMatch(/if\s*\(\s*!session\s*\)\s*return\s*<SignIn/)
    expect(source).toMatch(/GuestApp/)
    expect(source).toMatch(/getOrCreateGuestOwnerId/)
    expect(source).toMatch(/setLocalOnlySync\(true\)/)
  })
})
