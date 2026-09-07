// GET /api/cron/sync-resend  (Vercel Cron, daily)
// Projects every auth.users email into the Resend "Dayspring accounts" segment
// so Broadcasts can go to the live account list. No-op without RESEND_API_KEY.

import { isAuthorized, unauthorized } from '../_lib/auth.js'
import { env } from '../_lib/env.js'
import {
  accountContactsFromAuthUsers,
  liveResendTransport,
  syncAccountAudience,
} from '../_lib/resendAudience.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'

const PAGE = 1000

async function listAllAuthUsers() {
  const sb = supabaseAdmin()
  const users: Array<{ email?: string | null; user_metadata?: Record<string, unknown> | null }> = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) throw new Error(error.message)
    const batch = data.users ?? []
    users.push(
      ...batch.map((u) => ({
        email: u.email,
        user_metadata: (u.user_metadata ?? null) as Record<string, unknown> | null,
      })),
    )
    if (batch.length < PAGE) break
  }
  return users
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const key = env.resendKey()
  if (!key) {
    return Response.json({ skipped: true, reason: 'RESEND_API_KEY unset' })
  }

  try {
    const accounts = accountContactsFromAuthUsers(await listAllAuthUsers())
    const result = await syncAccountAudience(liveResendTransport(key), accounts, {
      segmentId: env.resendSegmentId(),
      segmentName: env.resendSegmentName(),
    })
    return Response.json({
      accounts: accounts.length,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[sync-resend]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
