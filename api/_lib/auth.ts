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

/** Header that scopes an all-owner cron (synthesize, echoes) to one account. */
export const CRON_OWNER_HEADER = 'x-dayspring-owner'
const OWNER_ID = /^[A-Za-z0-9_-]{8,64}$/

/**
 * Owner scope for a manual cron run. Only read after isAuthorized(req) — the
 * header means nothing without CRON_SECRET — and never sent by the scheduled
 * crons (vercel.json / the Worker's scheduled()), which still cover everyone.
 *   { owner: null }        no header: every owner (the normal cron)
 *   { owner: id }          valid header: that one owner only
 *   { error }              header present but malformed: refuse, never widen to all
 */
export function cronOwnerScope(req: Request): { owner: string | null } | { error: Response } {
  const raw = req.headers.get(CRON_OWNER_HEADER)
  if (raw === null) return { owner: null }
  const owner = raw.trim()
  if (!OWNER_ID.test(owner)) {
    return { error: Response.json({ error: `invalid ${CRON_OWNER_HEADER}` }, { status: 400 }) }
  }
  return { owner }
}
