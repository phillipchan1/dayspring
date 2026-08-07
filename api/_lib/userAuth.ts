import { supabaseAdmin } from './supabaseAdmin.js'

export interface AuthedUser {
  id: string
  email: string | undefined
  /** Provider of the identity this token was issued for ('google' | 'apple').
   *  On an account with both linked this reflects the most recent sign-in, so
   *  treat it as "how they got in just now", not "how they signed up". */
  provider: string | undefined
}

/**
 * Validates the Supabase JWT from the Authorization: Bearer header.
 * Returns the authenticated user or null on failure.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const {
    data: { user },
    error,
  } = await supabaseAdmin().auth.getUser(token)

  if (error || !user) return null
  const provider = user.app_metadata?.provider
  return {
    id: user.id,
    email: user.email,
    provider: typeof provider === 'string' ? provider : undefined,
  }
}

export function notAuthenticated(): Response {
  return Response.json({ error: 'not authenticated' }, { status: 401 })
}
