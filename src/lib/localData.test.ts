import { describe, expect, it } from 'vitest'
import { planFence } from './localData'

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
