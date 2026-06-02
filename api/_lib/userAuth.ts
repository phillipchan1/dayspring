import { supabaseAdmin } from './supabaseAdmin.js'

export interface AuthedUser {
  id: string
  email: string | undefined
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
  return { id: user.id, email: user.email }
}

export function notAuthenticated(): Response {
  return Response.json({ error: 'not authenticated' }, { status: 401 })
}
