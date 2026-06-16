import { requireSupabase } from './supabase'
import { isTauri } from './platform'
import { purgeOnSignOut } from './localData'

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

/**
 * Start Google OAuth.
 *
 * Web: normal in-page redirect.
 *
 * Desktop: Google blocks OAuth inside embedded webviews (the "flicker" — it
 * detects WKWebView and refuses). So we ask Supabase for the provider URL
 * WITHOUT navigating the webview (skipBrowserRedirect), then open it in the
 * user's real browser via the opener plugin. Google trusts that, and on
 * success redirects to dayspring://auth-callback, which the deep-link listener
 * (see initDeepLinkAuth) hands back to the app.
 */
export async function signInWithGoogle(): Promise<void> {
  const sb = requireSupabase()

  if (!isTauri()) {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl() },
    })
    if (error) throw error
    return
  }

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: DEEP_LINK_REDIRECT,
      skipBrowserRedirect: true, // don't navigate the embedded webview
    },
  })
  if (error) throw error
  if (!data?.url) throw new Error('No OAuth URL returned')

  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(data.url) // hand off to the system browser
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
