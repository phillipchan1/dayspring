import { invoke } from '@tauri-apps/api/core'
import { isDesktopTauri, isIOSTauri, isTauri } from './platform'
import { purgeOnSignOut } from './localData'
import { beginExternalTrip } from './appLockSuppress'
import { SIGN_IN_PROVIDERS, type AuthProvider } from './lastAuthProvider'
import { selectDayspringDeepLink } from './deepLink'

// Hosted HTTPS page that forwards the PKCE code to the dayspring:// deep-link
// and shows a "you can close this tab" message to the user.
const DEEP_LINK_REDIRECT = 'https://dayspring-eosin.vercel.app/auth/callback'

/** Where OAuth should return. Native apps use the deep-link scheme; web uses origin. */
export function authRedirectUrl(): string {
  return isTauri() ? DEEP_LINK_REDIRECT : window.location.origin
}

type OAuthProvider = AuthProvider

interface OAuthOptions {
  redirectTo: string
  skipBrowserRedirect?: boolean
}

interface OAuthUrlResult {
  data: { url?: string | null } | null
  error: Error | null
}

/** Exchange a PKCE `code` from an OAuth callback URL for a persisted session. */
export async function exchangeOAuthCode(code: string): Promise<void> {
  const { completeWorkersOAuthCallback } = await import('./authClient')
  await completeWorkersOAuthCallback(`?code=${encodeURIComponent(code)}`)
}

/** Finish sign-in from a dayspring:// or bridged HTTPS callback URL. */
export async function completeOAuthCallback(callbackUrl: string): Promise<void> {
  const url = new URL(callbackUrl)
  const code = url.searchParams.get('code')
  if (!code) throw new Error('No authorization code in OAuth callback')
  await exchangeOAuthCode(code)
}

/**
 * Drive an OAuth round-trip, whichever end it is for (a new sign-in or linking
 * a second provider onto the account that is already signed in).
 *
 * Web: normal in-page redirect.
 *
 * Native desktop: providers block OAuth inside embedded webviews, so we ask
 * Better Auth for the provider URL WITHOUT navigating the webview
 * (skipBrowserRedirect), then open it in the system browser. On success the
 * HTTPS bridge page forwards to dayspring://auth-callback, which
 * initDeepLinkAuth exchanges — completing the sign-in or the link.
 *
 * Native iOS: same PKCE flow, but ASWebAuthenticationSession presents the
 * provider login in an in-app sheet (App Store Guideline 4). The bridge page
 * still forwards to dayspring://, which the session intercepts and returns here.
 *
 * Desktop returns `'waiting-for-browser'` after the system browser opens —
 * sign-in finishes later via the deep link. The sign-in screen uses that to
 * offer Open again / Cancel if the window is closed.
 */
export type OAuthHandoff = 'completed' | 'waiting-for-browser'

async function runOAuth(
  start: (options: OAuthOptions) => Promise<OAuthUrlResult>,
): Promise<OAuthHandoff> {
  if (!isTauri()) {
    const { error } = await start({ redirectTo: authRedirectUrl() })
    if (error) throw error
    return 'completed'
  }

  const { data, error } = await start({
    redirectTo: DEEP_LINK_REDIRECT,
    skipBrowserRedirect: true,
  })
  if (error) throw error
  if (!data?.url) throw new Error('No OAuth URL returned')

  // Linking a second provider happens from inside the app, so this hand-off has
  // to be marked or the app lock closes behind it and the user returns from
  // Google to a PIN prompt. See lib/appLockSuppress.ts.
  beginExternalTrip()

  if (isIOSTauri()) {
    try {
      const callbackUrl = await invoke<string>('start_oauth_session', { authUrl: data.url })
      await completeOAuthCallback(callbackUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(msg || 'Could not open in-app sign-in')
    }
    return 'completed'
  }

  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(data.url)
  return 'waiting-for-browser'
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
  const { signInWorkersSocial } = await import('./authClient')
  return runOAuth((options) =>
    signInWorkersSocial({
      provider,
      callbackURL: options.redirectTo,
      ...(options.skipBrowserRedirect ? { disableRedirect: true } : {}),
    }),
  )
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

/**
 * Attach a second provider to the account that is ALREADY signed in.
 *
 * This is the answer to the Google/Apple duplicate-account problem. Linking
 * keys off the current session, not the email, so it works through Apple's
 * "Hide My Email" relay. It only prevents the split; it cannot merge two
 * accounts that already hold entries. Offer it before they diverge.
 */
export async function linkProvider(provider: OAuthProvider): Promise<OAuthHandoff> {
  const { linkWorkersSocial } = await import('./authClient')
  return runOAuth((options) =>
    linkWorkersSocial({
      provider,
      callbackURL: options.redirectTo,
      ...(options.skipBrowserRedirect ? { disableRedirect: true } : {}),
    }),
  )
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
export async function initDeepLinkAuth(): Promise<void> {
  if (!isTauri()) return

  const handle = async (urls: string[] | null) => {
    const picked = selectDayspringDeepLink(urls)
    if (!picked) return
    if (picked.kind === 'open') {
      await bringAppToForeground()
      return
    }
    try {
      await completeOAuthCallback(picked.url)
    } catch (err) {
      console.error('[auth] deep-link exchange failed', err)
    }
  }

  try {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')
    // App already running: URL arrives as an event.
    await onOpenUrl((urls) => void handle(urls))
    // App launched by the deep link: pick up the initial URL.
    await handle(await getCurrent())
  } catch (err) {
    console.error('[auth] deep-link init failed', err)
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
