import { requireSupabase } from './supabase'
import { isTauri } from './platform'
import { purgeOnSignOut } from './localData'
import { beginExternalTrip } from './appLockSuppress'

// Hosted HTTPS page that forwards the PKCE code to the dayspring:// deep-link
// and shows a "you can close this tab" message to the user. Using an HTTPS URL
// instead of the raw custom scheme avoids the browser tab hanging on an
// unrenderable protocol. Must be in Supabase → Auth → URL Configuration allowlist.
const DEEP_LINK_REDIRECT = 'https://dayspring-eosin.vercel.app/auth/callback'

/** Where OAuth should return. The native apps use the deep-link scheme; web
 *  uses the page origin. Both must be in Supabase's redirect allow-list. */
export function authRedirectUrl(): string {
  return isTauri() ? DEEP_LINK_REDIRECT : window.location.origin
}

type OAuthProvider = 'google' | 'apple'

/**
 * Start OAuth for Google or Apple.
 *
 * Web: normal in-page redirect.
 *
 * Native (desktop + iOS): providers block OAuth inside embedded webviews, so we
 * ask Supabase for the provider URL WITHOUT navigating the webview
 * (skipBrowserRedirect), then open it in the system browser. On success the
 * HTTPS bridge page forwards to dayspring://auth-callback, which
 * initDeepLinkAuth exchanges for a session.
 */
async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const sb = requireSupabase()

  if (!isTauri()) {
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl() },
    })
    if (error) throw error
    return
  }

  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: DEEP_LINK_REDIRECT,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  if (!data?.url) throw new Error('No OAuth URL returned')

  // Linking a second provider happens from inside the app, so this hand-off has
  // to be marked or the app lock closes behind it and the user returns from
  // Google to a PIN prompt. See lib/appLockSuppress.ts.
  beginExternalTrip()
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(data.url)
}

export async function signInWithGoogle(): Promise<void> {
  return signInWithProvider('google')
}

/** Sign in with Apple — required on iOS when Google is also offered (App Store 4.8). */
export async function signInWithApple(): Promise<void> {
  return signInWithProvider('apple')
}

export async function signOut(): Promise<void> {
  const sb = requireSupabase()
  await sb.auth.signOut()
  // Scrub cached journal content so it can't surface under the next person who
  // signs in on this browser. Onboarding flags survive (same user re-login).
  await purgeOnSignOut()
}

/**
 * Native apps (desktop + iOS): listen for the dayspring://auth-callback deep
 * link and finish sign-in. Supabase (PKCE) returns a `code` we exchange for a
 * session — which then persists via the origin-independent Tauri store. Also
 * handles the case where the app was launched cold by the deep link. No-ops on
 * web.
 */
export async function initDeepLinkAuth(): Promise<void> {
  if (!isTauri()) return

  const complete = async (urls: string[] | null) => {
    if (!urls?.length) return
    const cb = urls.find((u) => u.startsWith('dayspring://'))
    if (!cb) return
    try {
      // The code rides in the query string of the deep-link URL.
      const url = new URL(cb)
      const code = url.searchParams.get('code')
      if (!code) return
      const sb = requireSupabase()
      const { error } = await sb.auth.exchangeCodeForSession(code)
      if (error) throw error
    } catch (err) {
      console.error('[auth] deep-link exchange failed', err)
    }
  }

  try {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')
    // App already running: callback arrives as an event.
    await onOpenUrl((urls) => void complete(urls))
    // App launched by the deep link: pick up the initial URL.
    await complete(await getCurrent())
  } catch (err) {
    console.error('[auth] deep-link init failed', err)
  }
}
