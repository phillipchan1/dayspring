// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const completeWorkersOAuthCallback = vi.fn()
const getSessionState = vi.fn((): { session: { access_token: string; user: { id: string } } | null; loading: boolean } => ({
  session: null,
  loading: false,
}))
const track = vi.fn()

vi.mock('./authClient', () => ({
  completeWorkersOAuthCallback: (...args: unknown[]) => completeWorkersOAuthCallback(...args),
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

const { handleNativeOpenUrls, WEB_AUTH_ERROR_KEY } = await import('./auth')

describe('handleNativeOpenUrls', () => {
  beforeEach(() => {
    completeWorkersOAuthCallback.mockReset()
    completeWorkersOAuthCallback.mockResolvedValue(undefined)
    getSessionState.mockReturnValue({ session: null, loading: false })
    track.mockReset()
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('exchanges an auth-callback deep link and records that it arrived', async () => {
    await handleNativeOpenUrls(['dayspring://auth-callback?code=ott-1'])
    expect(completeWorkersOAuthCallback).toHaveBeenCalledWith('dayspring://auth-callback?code=ott-1')
    expect(track).toHaveBeenCalledWith('auth_callback_received', { via: 'deep_link' })
  })

  it('surfaces exchange failures instead of failing silently', async () => {
    completeWorkersOAuthCallback.mockRejectedValueOnce(new Error('Sign-in expired. Try again.'))
    const seen: string[] = []
    const onError = (e: Event) => seen.push((e as CustomEvent<string>).detail)
    window.addEventListener(WEB_AUTH_ERROR_KEY, onError)
    await handleNativeOpenUrls(['dayspring://auth-callback?code=dead'])
    window.removeEventListener(WEB_AUTH_ERROR_KEY, onError)
    expect(seen).toEqual(['Sign-in expired. Try again.'])
    expect(sessionStorage.getItem(WEB_AUTH_ERROR_KEY)).toBe('Sign-in expired. Try again.')
    expect(track).toHaveBeenCalledWith('auth_callback_failed', { via: 'deep_link', reason: 'expired' })
  })

  it('ignores a late callback once this device is already signed in', async () => {
    getSessionState.mockReturnValue({
      session: { access_token: 'tok.sig', user: { id: 'u1' } },
      loading: false,
    })
    await handleNativeOpenUrls(['dayspring://auth-callback?code=late'])
    expect(completeWorkersOAuthCallback).not.toHaveBeenCalled()
  })

  it('does not show an error if the claim poll signed in first', async () => {
    completeWorkersOAuthCallback.mockRejectedValueOnce(new Error('Sign-in expired. Try again.'))
    getSessionState
      .mockReturnValueOnce({ session: null, loading: false })
      .mockReturnValue({
        session: { access_token: 'tok.sig', user: { id: 'u1' } },
        loading: false,
      })
    const seen: string[] = []
    const onError = (e: Event) => seen.push((e as CustomEvent<string>).detail)
    window.addEventListener(WEB_AUTH_ERROR_KEY, onError)
    await handleNativeOpenUrls(['dayspring://auth-callback?code=used'])
    window.removeEventListener(WEB_AUTH_ERROR_KEY, onError)
    expect(seen).toEqual([])
    expect(sessionStorage.getItem(WEB_AUTH_ERROR_KEY)).toBeNull()
    expect(track).not.toHaveBeenCalledWith('auth_callback_failed', expect.anything())
  })
})
