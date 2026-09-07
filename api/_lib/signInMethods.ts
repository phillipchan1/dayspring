// Which buttons reach a given Dayspring account, and how we say so.
//
// Used when an App Store subscription turns out to belong to a different
// account than the one making the claim. That happens for a mundane reason: the
// same person signed up with Google, subscribed, then later tapped "Continue
// with Apple" and got a second, empty account (Apple's "Hide My Email" relay
// address never matches the Google one, so nothing links them automatically).
// Naming the provider they need turns a support email into one tap.

import { supabaseAdmin } from './supabaseAdmin.js'

const LABELS: Record<string, string> = { google: 'Google', apple: 'Apple' }

/** Sign-in providers on `userId`, narrowed to the ones we offer as buttons. */
export async function signInProvidersFor(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId)
    if (error) return []
    return (data?.user?.identities ?? [])
      .map((i) => i.provider)
      .filter((p) => p in LABELS)
  } catch {
    // The hint is a courtesy — never let it turn a clean 409 into a 500.
    return []
  }
}

/**
 * The 409 body for a subscription claimed by another account. Deliberately
 * names only the provider, never the other account's email address: the caller
 * proved they hold the App Store subscription, not that they own that account.
 */
export function crossAccountMessage(providers: string[]): string {
  const labels = providers.map((p) => LABELS[p]).filter(Boolean)

  if (labels.length === 0) {
    return (
      'This App Store subscription belongs to a different Dayspring account. ' +
      'Sign out here, then sign back in the way you did when you subscribed.'
    )
  }

  const named =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`

  return (
    `This App Store subscription is already on a Dayspring account that signs in with ${named}. ` +
    (labels.length === 1
      ? `Sign out here, then choose "Continue with ${labels[0]}" to get back to it.`
      : 'Sign out here, then use the button you used when you subscribed.')
  )
}
