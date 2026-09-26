import { afterEach, describe, expect, it } from 'vitest'
import {
  GUEST_OWNER_KEY,
  GUEST_OWNER_PREFIX,
  getOrCreateGuestOwnerId,
  isGuestOwnerId,
  readGuestOwnerId,
} from './guestOwner'

afterEach(() => {
  try {
    localStorage.removeItem(GUEST_OWNER_KEY)
  } catch {
    /* node env without storage — tests below install a stand-in */
  }
})

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

describe('guest owner id', () => {
  it('is namespaced so it cannot collide with an auth UUID', () => {
    expect(isGuestOwnerId('local:abc')).toBe(true)
    expect(isGuestOwnerId('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
  })

  it('persists a stable device-local id across reads', () => {
    installMemoryStorage()
    const a = getOrCreateGuestOwnerId()
    const b = getOrCreateGuestOwnerId()
    expect(a).toBe(b)
    expect(a.startsWith(GUEST_OWNER_PREFIX)).toBe(true)
    expect(readGuestOwnerId()).toBe(a)
  })
})
