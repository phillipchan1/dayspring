import { requireSupabase } from './supabase'
import { isTauri } from './platform'
import { purgeOnSignOut } from './localData'
import { SIGN_IN_PROVIDERS, type AuthProvider } from './lastAuthProvider'

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

type OAuthProvider = AuthProvider

interface OAuthOptions {
  redirectTo: string
  skipBrowserRedirect?: boolean
}

interface OAuthUrlResult {
  data: { url?: string | null } | null
  error: Error | null
}

/**
 * Drive an OAuth round-trip, whichever end it is for (a new sign-in or linking
 * a second provider onto the account that is already signed in).
 *
 * Web: normal in-page redirect.
 *
 * Native (desktop + iOS): providers block OAuth inside embedded webviews, so we
 * ask Supabase for the provider URL WITHOUT navigating the webview
 * (skipBrowserRedirect), then open it in the system browser. On success the
 * HTTPS bridge page forwards to dayspring://auth-callback, which
 * initDeepLinkAuth exchanges — completing the sign-in or the link.
 */
async function runOAuth(start: (options: OAuthOptions) => Promise<OAuthUrlResult>): Promise<void> {
  if (!isTauri()) {
    const { error } = await start({ redirectTo: authRedirectUrl() })
    if (error) throw error
    return
  }

  const { data, error } = await start({
    redirectTo: DEEP_LINK_REDIRECT,
    skipBrowserRedirect: true,
  })
  if (error) throw error
  if (!data?.url) throw new Error('No OAuth URL returned')

  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(data.url)
}

async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const sb = requireSupabase()
  return runOAuth((options) => sb.auth.signInWithOAuth({ provider, options }))
}

export async function signInWithGoogle(): Promise<void> {
  return signInWithProvider('google')
}

/** Sign in with Apple — required on iOS when Google is also offered (App Store 4.8). */
export async function signInWithApple(): Promise<void> {
  return signInWithProvider('apple')
}

/**
 * Attach a second provider to the account that is ALREADY signed in.
 *
 * This is the answer to the Google/Apple duplicate-account problem. Supabase
 * links identities automatically when both providers report the same verified
 * email, but Apple's "Hide My Email" hands out a per-app relay address that can
 * never match the Google one — so the second sign-in silently starts an empty
 * account instead. Linking keys off the current *session*, not the email, so it
 * works through the relay.
 *
 * It only prevents the split; it cannot merge two accounts that already hold
 * entries. Offer it before they diverge.
 *
 * Requires manual linking to be enabled on the Supabase project (Dashboard →
 * Authentication → Sign In / Up → Allow manual linking). Without it Supabase
 * rejects the call, which surfaces as an error on the button.
 */
export async function linkProvider(provider: OAuthProvider): Promise<void> {
  const sb = requireSupabase()
  return runOAuth((options) => sb.auth.linkIdentity({ provider, options }))
}

/**
 * Which of the sign-in buttons currently reach this account. Narrowed to the
 * providers we actually offer, so an identity we no longer show can't render a
 * row nobody can act on.
 */
export async function listSignInMethods(): Promise<OAuthProvider[]> {
  const sb = requireSupabase()
  const { data, error } = await sb.auth.getUserIdentities()
  if (error) throw error
  const linked = (data?.identities ?? []).map((i) => i.provider)
  return SIGN_IN_PROVIDERS.filter((p) => linked.includes(p))
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
