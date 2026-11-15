// Signing out is per-device. Better Auth's bearer is dropped on this device
// only; other devices keep their own `dayspring.workers.bearer`.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  session: { user: { id: 'u1' }, access_token: 'tok.sig' } as { user: { id: string }; access_token: string } | null,
  signOut: vi.fn(async () => {}),
  clear: vi.fn(),
  purge: vi.fn(async () => {}),
}))

vi.mock('./sessionStore', () => ({
  getSessionState: () => ({ session: h.session, loading: false }),
  clearWorkersSession: () => h.clear(),
}))
vi.mock('./authClient', () => ({
  signOutWorkers: () => h.signOut(),
}))
vi.mock('./localData', () => ({ purgeOnSignOut: h.purge }))

const { signOut } = await import('./auth')
const { forceReauth } = await import('./authError')

beforeEach(() => {
  h.session = { user: { id: 'u1' }, access_token: 'tok.sig' }
  h.signOut.mockClear()
  h.clear.mockClear()
  h.purge.mockClear()
})

describe('signOut', () => {
  it('ends this device’s session only', async () => {
    await signOut()
    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(h.clear).toHaveBeenCalledTimes(1)
  })

  it('still scrubs this device’s cached journal content', async () => {
    await signOut()
    expect(h.purge).toHaveBeenCalledTimes(1)
  })

  it('leaves a guest journal alone — it is the only copy', async () => {
    h.session = null
    await signOut()
    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(h.purge).not.toHaveBeenCalled()
  })
})

describe('forceReauth', () => {
  it('recovers from an invalid session without a second purge when already signed out', async () => {
    await forceReauth()
    expect(h.signOut).toHaveBeenCalledTimes(1)
  })
})
