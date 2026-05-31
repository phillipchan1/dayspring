import { requireSupabase } from './supabase'

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
