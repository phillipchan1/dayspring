// Notification delivery for reminders.
// Uses Resend (https://resend.com) when RESEND_API_KEY is set.
// Falls back to a console log — wire up a real transport when ready.
//
// For native/web push: add a push_subscriptions table, store the endpoint +
// keys when the user grants permission in the browser, and call the Web Push
// API here. The payload and deep-link pattern are identical.

import { env } from './env'

export interface ReminderNotification {
  to: string
  ownerName?: string
  sentence: string
  writtenDate: string   // human-readable, e.g. "March 14"
  entryId: string
}

export async function sendReminderNotification(opts: ReminderNotification): Promise<void> {
  const key = env.resendKey()

  if (!key) {
    console.log(
      `[remind] RESEND_API_KEY not configured — skipping email for entry ${opts.entryId}`,
    )
    return
  }

  const entryUrl = `${env.appUrl()}/?entry=${opts.entryId}`
  const name = opts.ownerName ?? 'Friend'

  const html = `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:2rem 1.5rem;color:#2a2a2a">
  <p style="font-size:0.85rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1.5rem">
    You wrote this on ${opts.writtenDate}
  </p>
  <p style="font-size:1.2rem;font-style:italic;line-height:1.65;margin:0 0 1.5rem">
    "${opts.sentence}"
  </p>
  <p style="font-size:0.95rem;color:#555;margin:0 0 2rem">
    Does it still feel true?
  </p>
  <a href="${entryUrl}" style="display:inline-block;padding:0.6rem 1.2rem;background:#2a2a2a;color:#fff;text-decoration:none;border-radius:6px;font-size:0.88rem">
    Open entry →
  </a>
</div>`

  const text = `You wrote this on ${opts.writtenDate}:\n\n"${opts.sentence}"\n\nDoes it still feel true?\n\n${entryUrl}`

  const body = {
    from: 'Dayspring <reminders@dayspring.app>',
    to: [opts.to],
    subject: 'A word from your past',
    html,
    text,
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
}
