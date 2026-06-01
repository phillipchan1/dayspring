import { env } from './env.js'

/**
 * Guard for the cron + manual endpoints. Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}`; the manual trigger must do the same.
 * Constant-time-ish compare is overkill for a single-user app, but we still
 * reject anything that doesn't match exactly.
 */
export function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${env.cronSecret()}`
  return header.length === expected.length && header === expected
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
