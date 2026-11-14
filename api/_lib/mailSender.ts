// Transport-neutral mail for the remind / welcome-drip crons.
//
// Vercel: no override is installed, so callers keep their Resend paths unchanged.
// Worker: worker/src/vercel/bridge.ts installs an override backed by the Cloudflare
// `EMAIL` send_email binding (sender hello@usedayspring.app). Every Worker send
// first checks public.email_suppressions (worker/schema/0008) and carries
// List-Unsubscribe (+ RFC 8058 one-click) headers.

import type { ResendRequest, ResendResponse, ResendTransport } from './resendAudience.js'
import { listUnsubscribeHeaders, normalizeEmail } from './unsubscribe.js'
import { WELCOME_TEMPLATE_SNAPSHOTS } from './welcomeTemplates.js'

/** The only sender the Worker's send_email binding allows. */
export const WORKER_MAIL_FROM = { name: 'Dayspring', email: 'hello@usedayspring.app' } as const

export interface MailMessage {
  to: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
}

export type MailResult = 'sent' | 'suppressed'

export interface MailSender {
  send(msg: MailMessage): Promise<MailResult>
  /** The footer unsubscribe URL for this recipient (one-click https, or mailto). */
  unsubscribeUrl(to: string): Promise<string>
}

let override: (() => MailSender | null) | null = null

/** Installed once by the Worker bridge; null (Vercel) leaves Resend in charge. */
export function setMailSenderOverride(fn: (() => MailSender | null) | null): void {
  override = fn
}

/** The Worker's mail sender for this request, or null on Vercel. */
export function mailSender(): MailSender | null {
  return override ? override() : null
}

export interface SendEmailBindingLike {
  send(m: {
    from: { name: string; email: string }
    to: string
    subject: string
    text?: string
    html?: string
    replyTo?: string
    headers?: Record<string, string>
  }): Promise<unknown>
}

/**
 * A MailSender over a send_email binding. `isSuppressed` is consulted before every
 * send; if it throws, nothing is sent (fail closed). `secret` signs one-click links.
 */
export function bindingMailSender(opts: {
  binding: SendEmailBindingLike
  isSuppressed: (email: string) => Promise<boolean>
  secret?: string | null
}): MailSender {
  return {
    async unsubscribeUrl(to) {
      return (await listUnsubscribeHeaders(to, opts.secret)).url
    },
    async send(msg) {
      if (!msg.text && !msg.html) throw new Error('mail: text or html is required')
      const to = normalizeEmail(msg.to)
      if (await opts.isSuppressed(to)) {
        console.log('[mail] suppressed recipient; not sent')
        return 'suppressed'
      }
      const { headers } = await listUnsubscribeHeaders(to, opts.secret)
      await opts.binding.send({
        from: { ...WORKER_MAIL_FROM },
        to: msg.to,
        subject: msg.subject,
        ...(msg.text ? { text: msg.text } : {}),
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
        headers: { ...headers, ...(msg.headers ?? {}) },
      })
      return 'sent'
    },
  }
}

/** Suppression lookup through the supabase-js-shaped client (pgrest shim on the Worker). */
export function suppressionLookup(client: {
  from(t: string): { select(c: string): { eq(c: string, v: string): { limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } } }
}): (email: string) => Promise<boolean> {
  return async (email) => {
    const { data, error } = await client.from('email_suppressions').select('email').eq('email', normalizeEmail(email)).limit(1)
    if (error) throw new Error(`email_suppressions lookup failed: ${error.message}`)
    return (data ?? []).length > 0
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Fill a snapshot template's placeholders. NAME falls back to "there", as in Resend. */
export function renderWelcomeTemplate(
  templateId: string,
  name: string | undefined,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const t = WELCOME_TEMPLATE_SNAPSHOTS[templateId]
  if (!t) throw new Error(`no welcome template snapshot for ${templateId}`)
  const n = name?.trim() || 'there'
  const fill = (s: string, html: boolean) =>
    s
      .replaceAll('{{{NAME}}}', html ? escapeHtml(n) : n)
      .replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', html ? escapeHtml(unsubscribeUrl) : unsubscribeUrl)
  return { subject: t.subject, html: fill(t.html, true), text: fill(t.text, false) }
}

/**
 * A ResendTransport look-alike for the welcome drip on the Worker: it accepts the
 * exact `POST /emails` template payload welcomeSendPayload() builds and sends the
 * rendered snapshot through the MailSender instead. Anything else is refused.
 * A suppressed recipient answers 200 (nothing sent) so the step is not retried.
 */
export function mailSenderWelcomeTransport(sender: MailSender): ResendTransport {
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
      rendered = renderWelcomeTemplate(body.template.id, body.template.variables?.NAME, await sender.unsubscribeUrl(to))
    } catch (e) {
      return { status: 422, json: { message: e instanceof Error ? e.message : String(e) } }
    }
    let result: MailResult
    try {
      result = await sender.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(body.reply_to ? { replyTo: body.reply_to } : {}),
      })
    } catch (e) {
      return { status: 502, json: { message: `send_email: ${e instanceof Error ? e.message : String(e)}` } }
    }
    return { status: 200, json: { id: null, via: 'cloudflare-email', suppressed: result === 'suppressed' } }
  }
}
