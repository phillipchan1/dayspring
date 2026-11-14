// Transport-neutral mail for the remind / welcome-drip crons.
//
// Vercel: no override is installed, so callers keep their Resend paths unchanged.
// Worker: worker/src/vercel/bridge.ts installs an override backed by the Cloudflare
// `EMAIL` send_email binding (sender hello@usedayspring.app), so the same handlers
// send without Resend.

import type { ResendRequest, ResendResponse, ResendTransport } from './resendAudience.js'
import { WELCOME_TEMPLATE_SNAPSHOTS } from './welcomeTemplates.js'

/** The only sender the Worker's send_email binding allows. */
export const WORKER_MAIL_FROM = { name: 'Dayspring', email: 'hello@usedayspring.app' } as const
/** Without Resend there is no hosted unsubscribe page: opt-out is a reply to this address. */
export const WORKER_UNSUBSCRIBE_MAILTO = 'mailto:hello@usedayspring.app?subject=unsubscribe'

export interface MailMessage {
  to: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
}

export type MailSender = (msg: MailMessage) => Promise<void>

let override: (() => MailSender | null) | null = null

/** Installed once by the Worker bridge; null (Vercel) leaves Resend in charge. */
export function setMailSenderOverride(fn: (() => MailSender | null) | null): void {
  override = fn
}

/** The Worker's mail sender for this request, or null on Vercel. */
export function mailSender(): MailSender | null {
  return override ? override() : null
}

/** Adapt a send_email binding (`env.EMAIL`) to MailSender. */
export function sendEmailBindingSender(binding: {
  send(m: {
    from: { name: string; email: string }
    to: string
    subject: string
    text?: string
    html?: string
    replyTo?: string
    headers?: Record<string, string>
  }): Promise<unknown>
}): MailSender {
  return async (msg) => {
    if (!msg.text && !msg.html) throw new Error('mail: text or html is required')
    await binding.send({
      from: { ...WORKER_MAIL_FROM },
      to: msg.to,
      subject: msg.subject,
      ...(msg.text ? { text: msg.text } : {}),
      ...(msg.html ? { html: msg.html } : {}),
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      ...(msg.headers ? { headers: msg.headers } : {}),
    })
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Fill a snapshot template's placeholders. NAME falls back to "there", as in Resend. */
export function renderWelcomeTemplate(
  templateId: string,
  name: string | undefined,
): { subject: string; html: string; text: string } {
  const t = WELCOME_TEMPLATE_SNAPSHOTS[templateId]
  if (!t) throw new Error(`no welcome template snapshot for ${templateId}`)
  const n = name?.trim() || 'there'
  const fill = (s: string, html: boolean) =>
    s
      .replaceAll('{{{NAME}}}', html ? escapeHtml(n) : n)
      .replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', WORKER_UNSUBSCRIBE_MAILTO)
  return { subject: t.subject, html: fill(t.html, true), text: fill(t.text, false) }
}

/**
 * A ResendTransport look-alike for the welcome drip on the Worker: it accepts the
 * exact `POST /emails` template payload welcomeSendPayload() builds and sends the
 * rendered snapshot through the MailSender instead. Anything else is refused.
 */
export function mailSenderWelcomeTransport(send: MailSender): ResendTransport {
  return async (req: ResendRequest): Promise<ResendResponse> => {
    const body = (req.body ?? {}) as {
      to?: string[] | string
      reply_to?: string
      template?: { id?: string; variables?: { NAME?: string } }
    }
    if (req.method !== 'POST' || req.path !== '/emails' || !body.template?.id) {
      return { status: 501, json: { message: `Worker mail transport handles only template sends (${req.method} ${req.path})` } }
    }
    const to = Array.isArray(body.to) ? body.to[0] : body.to
    if (!to) return { status: 422, json: { message: 'missing recipient' } }
    let rendered
    try {
      rendered = renderWelcomeTemplate(body.template.id, body.template.variables?.NAME)
    } catch (e) {
      return { status: 422, json: { message: e instanceof Error ? e.message : String(e) } }
    }
    try {
      await send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(body.reply_to ? { replyTo: body.reply_to } : {}),
        headers: { 'List-Unsubscribe': `<${WORKER_UNSUBSCRIBE_MAILTO}>` },
      })
    } catch (e) {
      return { status: 502, json: { message: `send_email: ${e instanceof Error ? e.message : String(e)}` } }
    }
    return { status: 200, json: { id: null, via: 'cloudflare-email' } }
  }
}
