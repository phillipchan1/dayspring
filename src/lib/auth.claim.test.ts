// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const claimNativeOAuth = vi.fn()
const completeWorkersOAuthToken = vi.fn()
const oauthErrorMessage = vi.fn((code: string) =>
  code === 'access_denied' ? 'Sign-in was cancelled.' : `mapped:${code}`,
)
const track = vi.fn()
const getSessionState = vi.fn((): { session: { user: { id: string } } | null } => ({ session: null }))

vi.mock('./authClient', () => ({
  claimNativeOAuth: (...args: unknown[]) => claimNativeOAuth(...args),
  completeWorkersOAuthToken: (...args: unknown[]) => completeWorkersOAuthToken(...args),
  oauthErrorMessage: (code: string) => oauthErrorMessage(code),
}))
vi.mock('./sessionStore', () => ({
  getSessionState: () => getSessionState(),
}))
vi.mock('./analytics', () => ({
  track: (...args: unknown[]) => track(...args),
}))
vi.mock('./platform', () => ({
  isDesktopTauri: () => true,
  isIOSTauri: () => false,
  isTauri: () => true,
}))

const { pollNativeOAuthClaim, createDeviceNonce, pkceChallenge } = await import('./auth')

describe('createDeviceNonce', () => {
  it('is URL-safe and long enough to bind a claim', () => {
    const nonce = createDeviceNonce()
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{32,}$/)
  })
})

describe('pkceChallenge', () => {
  it('is the S256 base64url digest of the verifier', async () => {
    const verifier = createDeviceNonce()
    const challenge = await pkceChallenge(verifier)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challenge).not.toBe(verifier)
    expect(await pkceChallenge(verifier)).toBe(challenge)
  })
})

describe('pollNativeOAuthClaim', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    claimNativeOAuth.mockReset()
    completeWorkersOAuthToken.mockReset()
    completeWorkersOAuthToken.mockResolvedValue(undefined)
    oauthErrorMessage.mockClear()
    track.mockReset()
    getSessionState.mockReset()
    getSessionState.mockReturnValue({ session: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('verifies the token the first time the claim is ready', async () => {
    claimNativeOAuth
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ token: 'ott-from-claim' })
    const ac = new AbortController()
    const done = pollNativeOAuthClaim('device-1', ac.signal)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(done).resolves.toBe('claimed')
    expect(completeWorkersOAuthToken).toHaveBeenCalledWith('ott-from-claim')
    expect(claimNativeOAuth).toHaveBeenCalledWith('device-1', undefined)
    expect(track).toHaveBeenCalledWith('auth_callback_received', { via: 'claim' })
  })

  it('posts the confirm code once the user types it', async () => {
    claimNativeOAuth
      .mockResolvedValueOnce({ pending: true })
      .mockResolvedValueOnce({ token: 'ott-from-confirm' })
    const ac = new AbortController()
    let confirm = ''
    const done = pollNativeOAuthClaim('device-1', ac.signal, () => confirm)
    await vi.advanceTimersByTimeAsync(0)
    confirm = 'ABC234'
    await vi.advanceTimersByTimeAsync(1000)
    await expect(done).resolves.toBe('claimed')
    expect(claimNativeOAuth).toHaveBeenLastCalledWith('device-1', 'ABC234')
  })

  it('is single-winner with abort: cancelling stops polling', async () => {
    claimNativeOAuth.mockResolvedValue(null)
    const ac = new AbortController()
    const done = pollNativeOAuthClaim('device-1', ac.signal)
    await vi.advanceTimersByTimeAsync(0)
    ac.abort()
    await vi.advanceTimersByTimeAsync(1000)
    await expect(done).resolves.toBe('aborted')
    expect(completeWorkersOAuthToken).not.toHaveBeenCalled()
  })

  it('surfaces a provider error from the claim', async () => {
    claimNativeOAuth.mockResolvedValueOnce({ error: 'access_denied' })
    const ac = new AbortController()
    const done = pollNativeOAuthClaim('device-1', ac.signal)
    await expect(done).rejects.toThrow('Sign-in was cancelled.')
    expect(track).toHaveBeenCalledWith('auth_callback_failed', {
      via: 'claim',
      reason: 'error',
    })
  })

  it('treats a used token as success when the deep link already signed in', async () => {
    claimNativeOAuth.mockResolvedValueOnce({ token: 'already-used' })
    completeWorkersOAuthToken.mockRejectedValueOnce(new Error('Sign-in expired. Try again.'))
    getSessionState
      .mockReturnValueOnce({ session: null })
      .mockReturnValue({ session: { user: { id: 'u1' } } })
    const ac = new AbortController()
    await expect(pollNativeOAuthClaim('device-1', ac.signal)).resolves.toBe('claimed')
    expect(track).not.toHaveBeenCalledWith('auth_callback_failed', expect.anything())
  })
})
