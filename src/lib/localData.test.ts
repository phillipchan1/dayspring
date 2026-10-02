import { describe, expect, it } from 'vitest'
import { accountRowsInGuestCache, planFence } from './localData'

const GUEST = 'local:11111111-1111-4111-8111-111111111111'
const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('planFence', () => {
  it('is a no-op for the same owner', () => {
    expect(planFence(ACCOUNT_A, ACCOUNT_A)).toEqual({ action: 'noop' })
    expect(planFence(GUEST, GUEST)).toEqual({ action: 'noop' })
  })

  it('claims a guest journal when an account signs in', () => {
    expect(planFence(GUEST, ACCOUNT_A)).toEqual({ action: 'claim-guest' })
  })

  it('purges when a different account takes over — never mixes tenants', () => {
    expect(planFence(ACCOUNT_A, ACCOUNT_B)).toEqual({ action: 'purge-all' })
  })

  it('does not treat an account cache as claimable guest work', () => {
    expect(planFence(ACCOUNT_A, GUEST)).toEqual({ action: 'purge-all' })
  })

  it('scrubs unread caches on first load when no owner was stored', () => {
    expect(planFence(null, ACCOUNT_A)).toEqual({ action: 'purge-content-if-idle' })
    expect(planFence(null, GUEST)).toEqual({ action: 'purge-content-if-idle' })
  })
})

describe('an account’s pages in a guest’s cache', () => {
  const synced = (id: string) => ({ id, base_body_markdown: 'what the server holds' })
  const guestWritten = (id: string) => ({ id })

  it('are the rows the server handed back, with nothing waiting to be pushed', () => {
    const rows = [synced('a'), synced('b'), guestWritten('g')]
    expect(accountRowsInGuestCache(rows, new Set(['g']))).toEqual(['a', 'b'])
  })

  it('never include what the guest wrote — it has no server base and is always pending', () => {
    expect(accountRowsInGuestCache([guestWritten('g1'), guestWritten('g2')], new Set(['g1', 'g2']))).toEqual([])
  })

  it('never include a row with unsynced work, even one the server has seen', () => {
    expect(accountRowsInGuestCache([synced('edited')], new Set(['edited']))).toEqual([])
  })

  it('include a page synced with an empty body', () => {
    expect(accountRowsInGuestCache([{ id: 'blank', base_body_markdown: '' }], new Set())).toEqual(['blank'])
  })
})
