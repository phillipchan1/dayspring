// Signing out is per-device. supabase-js's own default is `scope: 'global'`,
// which revokes the account's refresh tokens everywhere — so signing out of the
// Mac used to sign the iPhone out too. These tests hold the scope on the call
// itself, because nothing else would notice it drifting back.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
  signOut: vi.fn(async (_options?: { scope?: string }) => ({ error: null })),
  purge: vi.fn(async () => {}),
}))

vi.mock('./supabase', () => ({
  requireSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      signOut: h.signOut,
    },
  }),
}))
vi.mock('./localData', () => ({ purgeOnSignOut: h.purge }))

const { signOut } = await import('./auth')
const { forceReauth } = await import('./authError')

beforeEach(() => {
  h.session = { user: { id: 'u1' } }
  h.signOut.mockClear()
  h.purge.mockClear()
})

describe('signOut', () => {
  it('ends this device’s session only, never the account’s other devices', async () => {
    await signOut()
    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('still scrubs this device’s cached journal content', async () => {
    await signOut()
    expect(h.purge).toHaveBeenCalledTimes(1)
  })

  it('leaves a guest journal alone — it is the only copy', async () => {
    h.session = null
    await signOut()
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(h.purge).not.toHaveBeenCalled()
  })
})

describe('forceReauth', () => {
  it('recovers from an invalid session without touching the other devices', async () => {
    await forceReauth()
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
