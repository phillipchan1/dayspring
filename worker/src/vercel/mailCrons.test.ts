// Mail crons on the Worker send through the Cloudflare `EMAIL` binding (send_email),
// never Resend; on Vercel (no bridge) the Resend paths are unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runInBridge } from './bridge.ts'
import { sendReminderNotification } from '../../../api/_lib/notify.ts'
import { mailSender, mailSenderWelcomeTransport, renderWelcomeTemplate, WORKER_UNSUBSCRIBE_MAILTO } from '../../../api/_lib/mailSender.ts'
import { sendWelcomeTemplate, WELCOME_TEMPLATE_IDS, WELCOME_DRIP_REPLY_TO } from '../../../api/_lib/welcomeDrip.ts'
import { WELCOME_TEMPLATE_SNAPSHOTS } from '../../../api/_lib/welcomeTemplates.ts'

type Sent = Record<string, unknown>
function fakeEmail(fail = false) {
  const sent: Sent[] = []
  return { sent, binding: { send: vi.fn(async (m: Sent) => { if (fail) throw new Error('E_SENDER_NOT_VERIFIED'); sent.push(m); return { messageId: 'm1' } }) } }
}
const inWorker = <T>(email: unknown, fn: () => Promise<T>) =>
  runInBridge({ client: {} as never, waitUntil: () => undefined, kick: null, email: email as never }, fn)

const reminder = { to: 'a@example.test', sentence: 'Be still.', writtenDate: 'March 14', entryId: 'e1' }
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":"r1"}', { status: 200 }))
  process.env.CRON_SECRET = 'mail-cron'
})
afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.RESEND_API_KEY
})

describe('remind (notify.ts)', () => {
  it('Worker: sends through env.EMAIL from Dayspring <hello@usedayspring.app>; no Resend fetch', async () => {
    process.env.RESEND_API_KEY = 're_test'
    const { sent, binding } = fakeEmail()
    await inWorker(binding, () => sendReminderNotification(reminder))
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ from: { name: 'Dayspring', email: 'hello@usedayspring.app' }, to: 'a@example.test', subject: 'A word from your past' })
    expect(String(sent[0]!.text)).toContain('"Be still."')
    expect(String(sent[0]!.html)).toContain('?entry=e1')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Worker: a send_email failure surfaces (the cron logs it and still marks the reminder fired)', async () => {
    const { binding } = fakeEmail(true)
    await expect(inWorker(binding, () => sendReminderNotification(reminder))).rejects.toThrow('E_SENDER_NOT_VERIFIED')
  })

  it('Vercel (no bridge): Resend path unchanged', async () => {
    process.env.RESEND_API_KEY = 're_test'
    expect(mailSender()).toBeNull()
    await sendReminderNotification(reminder)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(JSON.parse(String(init.body))).toMatchObject({ from: 'Dayspring <reminders@dayspring.app>', to: ['a@example.test'] })
  })

  it('Vercel without RESEND_API_KEY: still a logged no-op', async () => {
    await sendReminderNotification(reminder)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Worker without an EMAIL binding falls back to the Vercel behavior', async () => {
    await inWorker(null, async () => expect(mailSender()).toBeNull())
  })
})

describe('welcome-drip on the Worker', () => {
  it('every published template has a snapshot that renders with no leftover placeholders', () => {
    for (const id of Object.values(WELCOME_TEMPLATE_IDS)) {
      expect(WELCOME_TEMPLATE_SNAPSHOTS[id], id).toBeDefined()
      const r = renderWelcomeTemplate(id, 'Ann')
      expect(r.subject.length).toBeGreaterThan(0)
      for (const body of [r.html, r.text]) {
        expect(body).not.toMatch(/\{\{\{/)
        expect(body).toContain(WORKER_UNSUBSCRIBE_MAILTO)
      }
      expect(r.text).toContain('Ann')
    }
  })

  it('NAME falls back to "there" and is HTML-escaped', () => {
    const id = WELCOME_TEMPLATE_IDS.welcome
    expect(renderWelcomeTemplate(id, '').text).toContain('Hi there,')
    const r = renderWelcomeTemplate(id, 'Ann <b>&')
    expect(r.html).toContain('Ann &lt;b&gt;&amp;')
    expect(r.html).not.toContain('Ann <b>&')
    expect(r.text).toContain('Ann <b>&')
  })

  it('the unchanged welcomeSendPayload goes out through env.EMAIL with reply-to and List-Unsubscribe', async () => {
    const { sent, binding } = fakeEmail()
    await inWorker(binding, async () => {
      const send = mailSender()!
      await sendWelcomeTemplate(mailSenderWelcomeTransport(send), {
        from: 'The Dayspring team <hello@usedayspring.app>', to: 'b@example.test', templateId: WELCOME_TEMPLATE_IDS.slash, name: 'Ben',
      })
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      from: { name: 'Dayspring', email: 'hello@usedayspring.app' },
      to: 'b@example.test',
      subject: WELCOME_TEMPLATE_SNAPSHOTS[WELCOME_TEMPLATE_IDS.slash]!.subject,
      replyTo: WELCOME_DRIP_REPLY_TO,
      headers: { 'List-Unsubscribe': `<${WORKER_UNSUBSCRIBE_MAILTO}>` },
    })
    expect(String(sent[0]!.text)).toContain('Ben')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('a failed send throws, so the step stays pending for the next run', async () => {
    const { binding } = fakeEmail(true)
    await expect(inWorker(binding, () =>
      sendWelcomeTemplate(mailSenderWelcomeTransport(mailSender()!), {
        from: 'x', to: 'b@example.test', templateId: WELCOME_TEMPLATE_IDS.welcome, name: 'Ben',
      }),
    )).rejects.toThrow(/Resend 502: send_email: E_SENDER_NOT_VERIFIED/)
  })

  it('liveWelcomeDripDeps picks the EMAIL transport on the Worker (no Resend fetch)', async () => {
    const { liveWelcomeDripDeps } = await import('../../../api/_lib/welcomeDripRun.ts')
    const { sent, binding } = fakeEmail()
    await inWorker(binding, async () => {
      const deps = liveWelcomeDripDeps()
      await sendWelcomeTemplate(deps.transport!, { from: deps.from, to: 'd@example.test', templateId: WELCOME_TEMPLATE_IDS.rituals, name: 'Dee' })
    })
    expect(sent).toHaveLength(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('unknown template ids and non-template requests are refused', async () => {
    const t = mailSenderWelcomeTransport(async () => {})
    expect((await t({ method: 'POST', path: '/emails', body: { to: ['c@x'], template: { id: 'nope' } } })).status).toBe(422)
    expect((await t({ method: 'GET', path: '/segments' })).status).toBe(501)
  })
})

describe('sync-resend', () => {
  const req = () => new Request('https://w/api/cron/sync-resend', { headers: { authorization: 'Bearer mail-cron' } })

  it('Worker: skips (Resend audience sync is Vercel-only), even with RESEND_API_KEY set', async () => {
    process.env.RESEND_API_KEY = 're_test'
    const { GET } = await import('../../../api/cron/sync-resend.ts')
    const { binding } = fakeEmail()
    const res = await inWorker(binding, () => GET(req()))
    expect(await res.json()).toMatchObject({ skipped: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Vercel without RESEND_API_KEY: unchanged skip reason', async () => {
    const { GET } = await import('../../../api/cron/sync-resend.ts')
    expect(await (await GET(req())).json()).toEqual({ skipped: true, reason: 'RESEND_API_KEY unset' })
  })
})
