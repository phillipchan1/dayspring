export type Preference = 'A' | 'B' | 'C' | 'other'

export interface FeedbackPayload {
  prototype: string
  preference: Preference
  otherDetail?: string
  notes?: string
}

const PREFS: Preference[] = ['A', 'B', 'C', 'other']

const SLUG = /^[a-z0-9-]+$/

export function parseFeedback(raw: unknown): FeedbackPayload | string {
  if (!raw || typeof raw !== 'object') return 'Invalid body'
  const o = raw as Record<string, unknown>

  const prototype = typeof o.prototype === 'string' ? o.prototype.trim().toLowerCase() : ''
  if (!prototype || !SLUG.test(prototype)) return 'Missing prototype slug'

  const preference = o.preference
  if (typeof preference !== 'string' || !PREFS.includes(preference as Preference)) {
    return 'Pick A, B, C, or something else'
  }

  const otherDetail = typeof o.otherDetail === 'string' ? o.otherDetail.slice(0, 500) : ''
  const notes = typeof o.notes === 'string' ? o.notes.slice(0, 2000) : ''
  if (preference === 'other' && !otherDetail.trim()) {
    return 'Tell us a little about the something else'
  }

  return {
    prototype,
    preference: preference as Preference,
    otherDetail,
    notes,
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function deliverFeedback(
  payload: FeedbackPayload,
  labels: Record<Preference, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'Email is not configured on this preview yet.' }

  const to = process.env.FEEDBACK_TO || 'hello@usedayspring.app'
  const from = process.env.FEEDBACK_FROM || 'Dayspring <reminders@usedayspring.app>'
  const label = labels[payload.preference]
  const name = titleCase(payload.prototype)
  const extra =
    payload.preference === 'other' && payload.otherDetail?.trim()
      ? `\nSomething else: ${payload.otherDetail.trim()}`
      : ''
  const notes = payload.notes?.trim() ? `\n\nNotes:\n${payload.notes.trim()}` : ''
  const text = `${name} prototype feedback\n\nPreference: ${label}${extra}${notes}\n\n— sent from prototypes.usedayspring.app/${payload.prototype}`

  const html = `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:1.5rem;color:#2a2118">
  <p style="font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;color:#8a7c69;margin:0 0 1rem">${escape(name)} prototype</p>
  <p style="font-size:1.2rem;margin:0 0 1rem"><strong>${escape(label)}</strong></p>
  ${
    extra
      ? `<p style="color:#4a4035;white-space:pre-wrap">${escape(payload.otherDetail!.trim())}</p>`
      : ''
  }
  ${
    notes
      ? `<p style="color:#4a4035;white-space:pre-wrap">${escape(payload.notes!.trim())}</p>`
      : ''
  }
  <p style="font-size:0.8rem;color:#b4a78f;margin-top:1.5rem">Walkthrough mockup · ${new Date().toISOString()}</p>
</div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${name} prototype: ${label}`,
      text,
      html,
    }),
  })

  if (!res.ok) {
    const err = (await res.text().catch(() => '')).slice(0, 180)
    console.error(`[prototype-feedback] Resend ${res.status}: ${err}`)
    return { ok: false, error: 'Could not send just now. Try again in a moment.' }
  }
  return { ok: true }
}
