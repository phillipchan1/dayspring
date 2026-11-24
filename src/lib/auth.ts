import { invoke } from '@tauri-apps/api/core'
import { isDesktopTauri, isIOSTauri, isTauri } from './platform'
import { purgeOnSignOut } from './localData'
import { beginExternalTrip } from './appLockSuppress'
import { SIGN_IN_PROVIDERS, type AuthProvider } from './lastAuthProvider'
import { selectDayspringDeepLink } from './deepLink'
import { track } from './analytics'

type OAuthProvider = AuthProvider

/**
 * Finish sign-in from `dayspring://auth-callback?code=…` (or `?error=…`).
 * The code is a one-time token for the session the sign-in browser created.
 */
export async function completeOAuthCallback(callbackUrl: string): Promise<void> {
  const { completeWorkersOAuthCallback } = await import('./authClient')
  await completeWorkersOAuthCallback(callbackUrl)
}

/**
 * Drive an OAuth round-trip, whichever end it is for (a new sign-in or linking
 * a second provider onto the account that is already signed in).
 *
 * Web: normal in-page redirect.
 *
 * Native desktop: providers block OAuth inside embedded webviews, so the
 * system browser opens the Worker's /api/auth/native/start, which runs the
 * whole provider round-trip in that browser (Better Auth's state and session
 * cookies have to live where the redirects happen, not in the webview) and
 * ends at dayspring://auth-callback?code=<one-time token>. initDeepLinkAuth
 * exchanges it — completing the sign-in or the link.
 *
 * Native iOS: same Worker flow, presented by ASWebAuthenticationSession as an
 * in-app sheet (App Store Guideline 4). The session intercepts dayspring://
 * and returns the URL here. See worker/src/nativeAuth.ts.
 *
 * Desktop returns `'waiting-for-browser'` after the system browser opens —
 * sign-in finishes later via the RFC 8252 loopback, the deep link, or the
 * hardened claim poll. The sign-in screen uses that to offer Open again /
 * Cancel if the window is closed.
 */
export type OAuthHandoff = 'completed' | 'waiting-for-browser'

const CLAIM_POLL_MS = 1000
const CLAIM_TIMEOUT_MS = 3 * 60 * 1000

/** High-entropy PKCE verifier the Mac app polls the Worker with after Google / Apple. */
export function createDeviceNonce(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function runOAuth(
  provider: OAuthProvider,
  intent: 'sign-in' | 'link',
): Promise<OAuthHandoff> {
  if (!isTauri()) {
    // Web runs the same Worker flow as the apps, with the browser as the sheet:
    // Better Auth's state and session cookies live on the auth origin, not on
    // dayspring-eosin.vercel.app (a proxy). The page comes back with
    // ?auth_code=, which initWebOAuthReturn exchanges on load.
    const { nativeOAuthStartUrl } = await import('./authClient')
    window.location.assign(await nativeOAuthStartUrl(provider, intent, window.location.origin))
    return 'completed'
  }

  const { nativeCallbackScheme, nativeOAuthStartUrl } = await import('./authClient')
  const verifier = isDesktopTauri() ? createDeviceNonce() : undefined
  const challenge = verifier ? await pkceChallenge(verifier) : undefined
  let loopback: string | undefined
  if (isDesktopTauri()) {
    try {
      const {
        beginLoopbackOAuth,
        createLoopbackState,
        loopbackCallbackMatches,
        waitLoopbackOAuth,
      } = await import('./loopbackOAuth')
      const state = createLoopbackState()
      const port = await beginLoopbackOAuth(state)
      loopback = `http://127.0.0.1:${port}/auth-callback/${state}`
      void waitLoopbackOAuth(CLAIM_TIMEOUT_MS)
        .then(async (url) => {
          try {
            if (!loopbackCallbackMatches(url, state)) {
              throw new Error('Sign-in didn’t finish. Try again.')
            }
            await completeOAuthCallback(url)
            track('auth_callback_received', { via: 'loopback' })
            await bringAppToForeground()
          } catch (err) {
            if (await hasWorkersSession()) return
            const message = err instanceof Error ? err.message : 'Sign-in didn’t finish. Try again.'
            track('auth_callback_failed', { via: 'loopback', reason: callbackFailReason(err) })
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent(WEB_AUTH_ERROR_KEY, { detail: message }))
            }
          }
        })
        .catch(() => {
          /* cancelled or timed out; claim poll / confirm code still run */
        })
    } catch {
      /* claim-only fallback if the loopback bind fails */
    }
  }
  const authUrl = await nativeOAuthStartUrl(
    provider,
    intent,
    undefined,
    {
      scheme: nativeCallbackScheme(),
      ...(challenge ? { device: challenge } : {}),
      ...(loopback ? { loopback } : {}),
    },
  )
  if (verifier) pendingClaimDevice = verifier

  // Linking a second provider happens from inside the app, so this hand-off has
  // to be marked or the app lock closes behind it and the user returns from
  // Google to a PIN prompt. See lib/appLockSuppress.ts.
  beginExternalTrip()

  if (isIOSTauri()) {
    try {
      const callbackUrl = await invoke<string>('start_oauth_session', { authUrl })
      await completeOAuthCallback(callbackUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(msg || 'Could not open in-app sign-in')
    }
    return 'completed'
  }

  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(authUrl)
  return 'waiting-for-browser'
}

let pendingClaimDevice: string | null = null

/** PKCE verifier for the in-flight Mac OAuth, if any. SignIn polls with it. */
export function takePendingOAuthDevice(): string | null {
  const device = pendingClaimDevice
  pendingClaimDevice = null
  return device
}

export async function cancelPendingOAuth(): Promise<void> {
  pendingClaimDevice = null
  try {
    const { cancelLoopbackOAuth } = await import('./loopbackOAuth')
    await cancelLoopbackOAuth()
  } catch {
    /* not desktop, or nothing listening */
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function callbackFailReason(err: unknown): 'expired' | 'missing_code' | 'error' | 'other' {
  const msg = err instanceof Error ? err.message : String(err)
  if (/expired/i.test(msg)) return 'expired'
  if (/no authorization code/i.test(msg)) return 'missing_code'
  if (/didn’t finish|did not finish|cancelled|canceled/i.test(msg)) return 'error'
  return 'other'
}

/**
 * Poll POST /api/auth/native/claim until the browser finishes, the user
 * cancels, or the one-time token expires. First of this, the loopback, and
 * the deep link wins. `getConfirm` is the 6-character code from the finish page.
 */
async function hasWorkersSession(): Promise<boolean> {
  try {
    const { getSessionState } = await import('./sessionStore')
    return Boolean(getSessionState().session)
  } catch {
    return false
  }
}

export async function pollNativeOAuthClaim(
  device: string,
  signal: AbortSignal,
  getConfirm?: () => string,
): Promise<'claimed' | 'aborted'> {
  const { claimNativeOAuth, completeWorkersOAuthToken, oauthErrorMessage } = await import('./authClient')
  const started = Date.now()
  while (!signal.aborted) {
    // Deep link / loopback may have already finished this sign-in.
    if (await hasWorkersSession()) return 'claimed'
    try {
      const payload = await claimNativeOAuth(device, getConfirm?.()?.trim())
      if (payload?.error) throw new Error(oauthErrorMessage(payload.error))
      if (payload?.token) {
        try {
          await completeWorkersOAuthToken(payload.token)
        } catch (err) {
          if (await hasWorkersSession()) return 'claimed'
          throw err
        }
        track('auth_callback_received', { via: 'claim' })
        await bringAppToForeground()
        return 'claimed'
      }
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return 'aborted'
      if (await hasWorkersSession()) return 'claimed'
      track('auth_callback_failed', { via: 'claim', reason: callbackFailReason(err) })
      throw err
    }
    if (Date.now() - started > CLAIM_TIMEOUT_MS) {
      const err = new Error('Sign-in didn’t finish. Try again.')
      track('auth_callback_failed', { via: 'claim', reason: 'expired' })
      throw err
    }
    try {
      await sleep(CLAIM_POLL_MS, signal)
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return 'aborted'
      throw err
    }
  }
  return 'aborted'
}

async function signInWithProvider(provider: OAuthProvider): Promise<OAuthHandoff> {
  // Dev-only `?__preview=signin`: show the busy state without a live backend.
  // `import.meta.env.DEV` is statically false in production; Vite drops this.
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as { __DAYSPRING_SIGNIN_PREVIEW__?: boolean }).__DAYSPRING_SIGNIN_PREVIEW__
  ) {
    await new Promise((r) => setTimeout(r, 1600))
    throw new Error('Preview: the in-app OAuth sheet would open here')
  }
  return runOAuth(provider, 'sign-in')
}

/** iOS native Sign in with Apple identity token (Better Auth idToken). */
export async function signInWithAppleIdToken(token: string, nonce?: string): Promise<void> {
  const { signInWorkersSocialIdToken } = await import('./authClient')
  await signInWorkersSocialIdToken('apple', token, nonce)
}

export async function signInWithGoogle(): Promise<OAuthHandoff> {
  return signInWithProvider('google')
}

/** Sign in with Apple — required on iOS when Google is also offered (App Store 4.8). */
export async function signInWithApple(): Promise<OAuthHandoff> {
  return signInWithProvider('apple')
}

/**
 * Email + password sign-in for App Store review and users who registered with
 * email. OAuth remains the primary path; this is the fallback Apple expects when
 * demo credentials are supplied in App Store Connect. Also the returning half
 * of the web email path — see signUpWithEmail below.
 */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const trimmed = email.trim()
  if (!trimmed || !password) throw new Error('Enter your email and password')
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as { __DAYSPRING_SIGNIN_PREVIEW__?: boolean }).__DAYSPRING_SIGNIN_PREVIEW__
  ) {
    await new Promise((r) => setTimeout(r, 1200))
    throw new Error('Preview: email sign-in would complete here')
  }
  const { signInWorkersEmail } = await import('./authClient')
  await signInWorkersEmail(trimmed, password)
}

/**
 * Create a brand-new account with email + password. This is the only path
 * into Dayspring for a visitor without a Google or Apple account, so it has
 * to work on its own — not just as an App Review fallback for an account that
 * already exists (that's signInWithEmail above).
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ needsConfirmation: boolean }> {
  const trimmed = email.trim()
  if (!trimmed || !password) throw new Error('Enter your email and password')
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as { __DAYSPRING_SIGNIN_PREVIEW__?: boolean }).__DAYSPRING_SIGNIN_PREVIEW__
  ) {
    await new Promise((r) => setTimeout(r, 1200))
    throw new Error('Preview: account creation would complete here')
  }
  const { signUpWorkersEmail } = await import('./authClient')
  return signUpWorkersEmail(trimmed, password)
}

/** Mac (and any client that wants a browser-free path): email a 6-digit code. */
export async function sendEmailCode(email: string): Promise<void> {
  const trimmed = email.trim()
  if (!trimmed) throw new Error('Enter your email')
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as { __DAYSPRING_SIGNIN_PREVIEW__?: boolean }).__DAYSPRING_SIGNIN_PREVIEW__
  ) {
    await new Promise((r) => setTimeout(r, 800))
    return
  }
  const { sendWorkersEmailOtp } = await import('./authClient')
  await sendWorkersEmailOtp(trimmed)
}

export async function signInWithEmailCode(email: string, code: string): Promise<void> {
  const trimmed = email.trim()
  const otp = code.replace(/\s/g, '')
  if (!trimmed || !otp) throw new Error('Enter the code we sent')
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as { __DAYSPRING_SIGNIN_PREVIEW__?: boolean }).__DAYSPRING_SIGNIN_PREVIEW__
  ) {
    await new Promise((r) => setTimeout(r, 800))
    throw new Error('Preview: email-code sign-in would complete here')
  }
  const { signInWorkersEmailOtp } = await import('./authClient')
  await signInWorkersEmailOtp(trimmed, otp)
}

/**
 * Attach a second provider to the account that is ALREADY signed in.
 *
 * This is the answer to the Google/Apple duplicate-account problem. Linking
 * keys off the current session, not the email, so it works through Apple's
 * "Hide My Email" relay. It only prevents the split; it cannot merge two
 * accounts that already hold entries. Offer it before they diverge.
 */
export async function linkProvider(provider: OAuthProvider): Promise<OAuthHandoff> {
  return runOAuth(provider, 'link')
}

/**
 * Which of the sign-in buttons currently reach this account. Narrowed to the
 * providers we actually offer, so an identity we no longer show can't render a
 * row nobody can act on.
 */
export async function listSignInMethods(): Promise<OAuthProvider[]> {
  const { listWorkersSignInMethods } = await import('./authClient')
  const linked = await listWorkersSignInMethods()
  return SIGN_IN_PROVIDERS.filter((p) => linked.includes(p))
}

/**
 * Sign THIS device out — and only this device.
 *
 * Better Auth signOut plus dropping `dayspring.workers.bearer` leaves other
 * devices alone. This also bounds `forceReauth`: it calls here on any 401/403.
 */
export async function signOut(): Promise<void> {
  const { clearWorkersSession, getSessionState } = await import('./sessionStore')
  const hadSession = Boolean(getSessionState().session)
  const { signOutWorkers } = await import('./authClient')
  await signOutWorkers()
  clearWorkersSession()
  // Only an authenticated session owns a tenant cache that must be scrubbed.
  // A guest journal is the only copy of that writing — leave it on the device.
  if (!hadSession) return
  await purgeOnSignOut()
}

/**
 * Native apps (desktop + iOS): listen for dayspring:// deep links.
 *
 * `dayspring://auth-callback` finishes OAuth (Better Auth PKCE `code` → session
 * via the origin-independent Tauri store). Highest priority when a batch
 * also contains `open`.
 *
 * `dayspring://open` brings the installed app forward — Mac focuses the main
 * window (including after ⌘W hid it); iOS is already becoming active because
 * the OS delivered the custom-scheme open. No navigation; same shell as a
 * normal launch. Trailing slash / empty query are accepted.
 *
 * Cold launch: `getCurrent()` returns the URL that started the process;
 * `open` is a no-op besides the focus call, so bootstrap continues into
 * journal or sign-in as usual. Web: no-op.
 *
 * On iOS, ASWebAuthenticationSession usually completes inline; this listener
 * remains the fallback when the app is cold-started by the OAuth deep link.
 */
export async function handleNativeOpenUrls(urls: string[] | null): Promise<void> {
  const picked = selectDayspringDeepLink(urls)
  if (!picked) return
  if (picked.kind === 'open') {
    await bringAppToForeground()
    return
  }
  try {
    const { getSessionState } = await import('./sessionStore')
    if (getSessionState().session) {
      await bringAppToForeground()
      return
    }
    await completeOAuthCallback(picked.url)
    track('auth_callback_received', { via: 'deep_link' })
    await bringAppToForeground()
  } catch (err) {
    if (await hasWorkersSession()) {
      await bringAppToForeground()
      return
    }
    const message = err instanceof Error ? err.message : 'Sign-in didn’t finish. Try again.'
    track('auth_callback_failed', { via: 'deep_link', reason: callbackFailReason(err) })
    try {
      sessionStorage.setItem(WEB_AUTH_ERROR_KEY, message)
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WEB_AUTH_ERROR_KEY, { detail: message }))
    }
    console.error('[auth] deep-link exchange failed', err)
  }
}

export async function initDeepLinkAuth(): Promise<void> {
  if (!isTauri()) return

  try {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')
    // App already running: URL arrives as an event.
    await onOpenUrl((urls) => void handleNativeOpenUrls(urls))
    // App launched by the deep link: pick up the initial URL.
    await handleNativeOpenUrls(await getCurrent())
  } catch (err) {
    console.error('[auth] deep-link init failed', err)
  }
}

export const WEB_AUTH_ERROR_KEY = 'dayspring.authError'

/**
 * Web: finish a Google / Apple sign-in or link that returned to this page with
 * `?auth_code=` (or `?auth_error=`). Strips the params first so a reload or a
 * shared URL never replays them. A failure is left in sessionStorage for the
 * sign-in screen to show. No-op in the native apps and on ordinary loads.
 */
export async function initWebOAuthReturn(): Promise<void> {
  if (isTauri() || typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const code = url.searchParams.get('auth_code')
  const error = url.searchParams.get('auth_error')
  if (!code && !error) return
  url.searchParams.delete('auth_code')
  url.searchParams.delete('auth_error')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  const query = code ? `?code=${encodeURIComponent(code)}` : `?error=${encodeURIComponent(error ?? '')}`
  try {
    await completeOAuthCallback(query)
    try { sessionStorage.removeItem(WEB_AUTH_ERROR_KEY) } catch { /* ignore */ }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in didn’t finish. Try again.'
    try { sessionStorage.setItem(WEB_AUTH_ERROR_KEY, message) } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(WEB_AUTH_ERROR_KEY, { detail: message }))
    console.error('[auth] web sign-in return failed', err)
  }
}

/** Mac: show + focus the main window. iOS activation is OS-owned. */
async function bringAppToForeground(): Promise<void> {
  if (!isDesktopTauri()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    await win.unminimize()
    await win.show()
    await win.setFocus()
  } catch (err) {
    console.error('[auth] deep-link focus failed', err)
  }
}
