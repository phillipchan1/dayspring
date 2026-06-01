import { requireSupabase } from './supabase'

/** Where Google OAuth should return — must match a Supabase redirect allow-list entry. */
export function authRedirectUrl(): string {
  return window.location.origin
}

/** Start the Google OAuth flow. Redirects back to the app on success. */
export async function signInWithGoogle(): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectUrl(),
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const sb = requireSupabase()
  await sb.auth.signOut()
}
