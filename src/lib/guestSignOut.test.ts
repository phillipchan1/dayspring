import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Guest writing lives only on this device. Sign-out of no account, and the
 * privacy purge that follows a real sign-out, must not delete it.
 */

const guestEntries = new Set<string>()
const cacheClearAll = vi.fn(async () => {
  guestEntries.clear()
})

vi.mock('./db', () => ({
  cacheClearAll: () => cacheClearAll(),
  dictationCount: async () => 0,
  outboxCount: async () => 0,
  pendingUploadCount: async () => 0,
}))

const h = vi.hoisted(() => ({
  session: null as { user: { id: string }; access_token: string } | null,
  signOut: vi.fn(async () => {}),
}))

vi.mock('./sessionStore', () => ({
  getSessionState: () => ({ session: h.session, loading: false }),
  clearWorkersSession: () => {
    h.session = null
  },
}))
vi.mock('./authClient', () => ({
  signOutWorkers: () => h.signOut(),
}))

import { purgeOnSignOut, readCacheOwner } from './localData'
import { signOut } from './auth'

const GUEST = 'local:11111111-1111-4111-8111-111111111111'
const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER_KEY = 'dayspring.cache_owner'

function installMemoryStorage() {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

describe('signOut / purge with no session leaves guest entries intact', () => {
  beforeEach(() => {
    installMemoryStorage()
    guestEntries.clear()
    guestEntries.add('guest-entry-1')
    cacheClearAll.mockClear()
    h.signOut.mockClear()
    h.session = null
    localStorage.setItem(OWNER_KEY, GUEST)
  })

  afterEach(() => {
    guestEntries.clear()
  })

  it('purgeOnSignOut is a no-op when the cache owner is a guest', async () => {
    await purgeOnSignOut()
    expect(guestEntries.has('guest-entry-1')).toBe(true)
    expect(cacheClearAll).not.toHaveBeenCalled()
    expect(readCacheOwner()).toBe(GUEST)
  })

  it('signOut with no authenticated session does not purge', async () => {
    await signOut()
    expect(h.signOut).toHaveBeenCalled()
    expect(guestEntries.has('guest-entry-1')).toBe(true)
    expect(cacheClearAll).not.toHaveBeenCalled()
    expect(readCacheOwner()).toBe(GUEST)
  })

  it('signed-in sign-out still purges that account’s cached data', async () => {
    localStorage.setItem(OWNER_KEY, ACCOUNT)
    guestEntries.add('account-entry')
    h.session = { access_token: 't', user: { id: ACCOUNT } }
    await signOut()
    expect(h.signOut).toHaveBeenCalled()
    expect(cacheClearAll).toHaveBeenCalled()
    expect(guestEntries.size).toBe(0)
    expect(readCacheOwner()).toBeNull()
  })
})
