/**
 * Which button this device signed in with last time.
 *
 * Offering both Google and Apple means a returning user can pick the other one
 * by accident and land in a brand-new, empty account — and with Apple's "Hide My
 * Email" the addresses don't match, so nothing links them. The cheapest fix is
 * to remember and remind.
 *
 * Device-scoped, not owner-scoped: it answers "which button did this device use
 * last", so it deliberately survives sign-out (that is the moment it matters).
 * It holds no content and no address — just 'google' or 'apple'.
 */

const KEY = 'dayspring.last_auth_provider'

export type AuthProvider = 'google' | 'apple'

/** Every provider Dayspring offers, in the order we name them in copy. */
export const SIGN_IN_PROVIDERS: readonly AuthProvider[] = ['google', 'apple']

export const PROVIDER_LABEL: Record<AuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
}

function isAuthProvider(value: unknown): value is AuthProvider {
  return value === 'google' || value === 'apple'
}

/** The provider used for the last successful sign-in, or null if unknown. */
export function readLastAuthProvider(): AuthProvider | null {
  try {
    const raw = localStorage.getItem(KEY)
    return isAuthProvider(raw) ? raw : null
  } catch {
    return null
  }
}

/**
 * Record the provider from a signed-in session. Takes `unknown` because it is
 * fed straight from `user.app_metadata.provider`, which is untyped and can be
 * anything (email, a provider we don't offer) — those are ignored rather than
 * stored, so the hint is never wrong about a button we actually show.
 */
export function rememberAuthProvider(provider: unknown): void {
  if (!isAuthProvider(provider)) return
  try {
    localStorage.setItem(KEY, provider)
  } catch {
    /* private mode / storage disabled — the hint is optional */
  }
}
