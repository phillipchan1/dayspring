import { requireSupabase } from './supabase'
import { env } from './env'

/** Start the Google OAuth flow. Redirects back to the app on success. */
export async function signInWithGoogle(): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const sb = requireSupabase()
  await sb.auth.signOut()
}

/**
 * The single-user lock (§2, §9). Only the allowlisted email may use the app.
 * Belt-and-suspenders on top of restricting the Google OAuth consent screen.
 */
export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email || !env.allowedEmail) return false
  return email.trim().toLowerCase() === env.allowedEmail
}
