import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKERS_BEARER_KEY } from './workersBearer'

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
  return store
}

vi.mock('./analytics', () => ({
  applyAuthAnalytics: () => {},
  track: () => {},
}))
vi.mock('./lastAuthProvider', () => ({
  rememberAuthProvider: () => {},
}))
vi.mock('./localData', () => ({
  readCacheOwner: () => null,
}))

const { applyWorkersSession, clearWorkersSession, getSessionState } = await import('./sessionStore')
const { rememberWorkersBearer, readWorkersBearer, WORKERS_BEARER_KEY: KEY } = await import('./workersBearer')

describe('Better Auth session store', () => {
  beforeEach(() => {
    installMemoryStorage()
    clearWorkersSession()
  })

  afterEach(() => {
    clearWorkersSession()
  })

  it('keeps dayspring.workers.bearer in the signed token.hmac form', () => {
    expect(KEY).toBe('dayspring.workers.bearer')
    expect(WORKERS_BEARER_KEY).toBe('dayspring.workers.bearer')
    rememberWorkersBearer('token.hmacvalue')
    expect(readWorkersBearer()).toBe('token.hmacvalue')
    expect(localStorage.getItem('dayspring.workers.bearer')).toBe('token.hmacvalue')
  })

  it('hydrates a session from a live Better Auth sign-in without rewriting the bearer', () => {
    rememberWorkersBearer('live.token')
    applyWorkersSession({
      token: 'live.token',
      userId: 'u-1',
      email: 'a@example.com',
      event: 'SIGNED_IN',
    })
    expect(getSessionState().session).toEqual({
      access_token: 'live.token',
      user: { id: 'u-1', email: 'a@example.com' },
    })
    expect(localStorage.getItem('dayspring.workers.bearer')).toBe('live.token')
  })

  it('clears the bearer only on an explicit sign-out', () => {
    rememberWorkersBearer('live.token')
    applyWorkersSession({ token: 'live.token', userId: 'u-1' })
    clearWorkersSession()
    expect(getSessionState().session).toBeNull()
    expect(readWorkersBearer()).toBeNull()
  })
})
