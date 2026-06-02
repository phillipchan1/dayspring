// POST /api/cron/remind  (Vercel Cron, daily at 09:00 UTC)
// Finds unfired reminders that are due, sends a notification, and marks them fired.

import { isAuthorized, unauthorized } from '../_lib/auth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { sendReminderNotification } from '../_lib/notify.js'
import { env } from '../_lib/env.js'

interface ReminderRow {
  id: string
  owner: string
  entry_id: string | null
  content: string
  remind_at: string
  created_at: string
}

interface UserRow {
  id: string
  email: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const sb = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: due, error } = await sb
    .from('reminders')
    .select('id, owner, entry_id, content, remind_at, created_at')
    .eq('fired', false)
    .lte('remind_at', now)

  if (error) {
    console.error('[remind] query error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const rows = (due ?? []) as ReminderRow[]
  if (rows.length === 0) return Response.json({ fired: 0 })

  // Batch-fetch user emails (service-role bypasses auth schema restrictions).
  const ownerIds = [...new Set(rows.map((r) => r.owner))]
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>(
    (users?.users ?? [])
      .filter((u): u is UserRow => Boolean(u.id && u.email))
      .filter((u) => ownerIds.includes(u.id))
      .map((u) => [u.id, u.email] as [string, string]),
  )

  const appUrl = env.appUrl()
  let fired = 0
  const errors: string[] = []

  for (const row of rows) {
    const email = emailById.get(row.owner)
    if (!email) continue

    try {
      await sendReminderNotification({
        to: email,
        sentence: row.content,
        writtenDate: formatDate(row.created_at),
        entryId: row.entry_id ?? '',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${row.id}: ${msg}`)
      console.error('[remind] notify error:', row.id, msg)
    }

    // Always mark fired even if the notification fails — don't re-send.
    const { error: updateErr } = await sb
      .from('reminders')
      .update({ fired: true })
      .eq('id', row.id)

    if (updateErr) {
      errors.push(`${row.id}: mark-fired failed: ${updateErr.message}`)
    } else {
      fired++
    }
  }

  return Response.json({ fired, errors: errors.length > 0 ? errors : undefined })
}
