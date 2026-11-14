// Mail crons on the Worker send through the Cloudflare `EMAIL` binding (send_email),
// never Resend; on Vercel (no bridge) the Resend paths are unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runInBridge } from './bridge.ts'
import { sendReminderNotification } from '../../../api/_lib/notify.ts'
import { bindingMailSender, mailSender, mailSenderWelcomeTransport, renderWelcomeTemplate } from '../../../api/_lib/mailSender.ts'
import { UNSUBSCRIBE_MAILTO, verifyUnsubscribe } from '../../../api/_lib/unsubscribe.ts'
import { readFileSync } from 'node:fs'
import { sendWelcomeTemplate, WELCOME_TEMPLATE_IDS, WELCOME_DRIP_REPLY_TO } from '../../../api/_lib/welcomeDrip.ts'
import { WELCOME_TEMPLATE_SNAPSHOTS } from '../../../api/_lib/welcomeTemplates.ts'

type Sent = Record<string, unknown>
function fakeEmail(fail = false) {
  const sent: Sent[] = []
  return { sent, binding: { send: vi.fn(async (m: Sent) => { if (fail) throw new Error('E_SENDER_NOT_VERIFIED'); sent.push(m); return { messageId: 'm1' } }) } }
}
const SECRET = 'unsub-secret-for-tests'
// A pgrest-shaped client whose email_suppressions table holds `suppressed`.
function suppressionClient(suppressed: string[] = [], fail = false) {
  return {
    from: (t: string) => ({
      select: () => ({
        eq: (_c: string, v: string) => ({
          limit: async () => {
            if (t !== 'email_suppressions') throw new Error(`unexpected table ${t}`)
            if (fail) return { data: null, error: { message: 'db down' } }
            return { data: suppressed.includes(v) ? [{ email: v }] : [], error: null }
          },
        }),
      }),
    }),
  }
}
const inWorker = <T>(email: unknown, fn: () => Promise<T>, client: unknown = suppressionClient()) =>
  runInBridge({ client: client as never, waitUntil: () => undefined, kick: null, email: email as never, unsubscribeSecret: SECRET }, fn)

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
    const h = sent[0]!.headers as Record<string, string>
    expect(h['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(h['List-Unsubscribe']).toMatch(/^<https:\/\/api\.usedayspring\.app\/api\/email\/unsubscribe\?e=[^>]+>, <mailto:hello@usedayspring\.app\?subject=unsubscribe>$/)
    const u = new URL(h['List-Unsubscribe']!.slice(1, h['List-Unsubscribe']!.indexOf('>')))
    expect(await verifyUnsubscribe(u.searchParams.get('e'), u.searchParams.get('t'), SECRET)).toBe('a@example.test')
  })

  it('Worker: a suppressed address is never sent (case-insensitive), and nothing reaches Resend', async () => {
    process.env.RESEND_API_KEY = 're_test'
    const { sent, binding } = fakeEmail()
    await inWorker(binding, () => sendReminderNotification({ ...reminder, to: ' A@Example.TEST ' }), suppressionClient(['a@example.test']))
    expect(sent).toHaveLength(0)
    expect(binding.send).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Worker: a suppression lookup error fails closed (nothing sent)', async () => {
    const { binding } = fakeEmail()
    await expect(inWorker(binding, () => sendReminderNotification(reminder), suppressionClient([], true))).rejects.toThrow(/email_suppressions lookup failed/)
    expect(binding.send).not.toHaveBeenCalled()
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
  it('every template text part is the marketing .txt byte for byte (placeholders aside)', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../marketing/email/welcome/templates/manifest.json', import.meta.url), 'utf8')) as Array<{ key: string; text: string }>
    for (const [key, id] of Object.entries(WELCOME_TEMPLATE_IDS)) {
      const e = manifest.find((x) => x.key === key)
      expect(e, `manifest entry for ${key}`).toBeDefined()
      const txt = readFileSync(new URL(`../../../marketing/email/welcome/templates/${e!.text}`, import.meta.url), 'utf8')
      expect(WELCOME_TEMPLATE_SNAPSHOTS[id]!.text, key).toBe(txt)
    }
  })

  it('every published template renders with no leftover placeholders and the one-click link', () => {
    const url = 'https://api.usedayspring.app/api/email/unsubscribe?e=x&t=y'
    for (const id of Object.values(WELCOME_TEMPLATE_IDS)) {
      expect(WELCOME_TEMPLATE_SNAPSHOTS[id], id).toBeDefined()
      const r = renderWelcomeTemplate(id, 'Ann', url)
      expect(r.subject.length).toBeGreaterThan(0)
      for (const body of [r.html, r.text]) expect(body).not.toMatch(/\{\{\{/)
      expect(r.text).toContain(url)
      expect(r.html).toContain(url.replace('&', '&amp;'))
      expect(r.text).toContain('Ann')
    }
  })

  it('NAME falls back to "there" and is HTML-escaped', () => {
    const id = WELCOME_TEMPLATE_IDS.welcome
    expect(renderWelcomeTemplate(id, '', UNSUBSCRIBE_MAILTO).text).toContain('Hi there,')
    const r = renderWelcomeTemplate(id, 'Ann <b>&', UNSUBSCRIBE_MAILTO)
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
      headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    const h = sent[0]!.headers as Record<string, string>
    const link = h['List-Unsubscribe']!.slice(1, h['List-Unsubscribe']!.indexOf('>'))
    expect(String(sent[0]!.text)).toContain('Ben')
    expect(String(sent[0]!.text)).toContain(link)
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

  it('a suppressed recipient answers 200 {suppressed} with nothing sent, so the step is not retried', async () => {
    const { binding } = fakeEmail()
    const res = await inWorker(binding, () =>
      mailSenderWelcomeTransport(mailSender()!)({ method: 'POST', path: '/emails', body: { to: ['B@example.test'], template: { id: WELCOME_TEMPLATE_IDS.welcome, variables: { NAME: 'Ben' } } } }),
      suppressionClient(['b@example.test']))
    expect(res).toMatchObject({ status: 200, json: { suppressed: true } })
    expect(binding.send).not.toHaveBeenCalled()
  })

  it('without an unsubscribe secret, headers fall back to mailto only (no List-Unsubscribe-Post)', async () => {
    const { sent, binding } = fakeEmail()
    const s = bindingMailSender({ binding: binding as never, isSuppressed: async () => false, secret: null })
    await s.send({ to: 'c@example.test', subject: 's', text: 't' })
    expect(sent[0]!.headers).toEqual({ 'List-Unsubscribe': `<${UNSUBSCRIBE_MAILTO}>` })
  })

  it('unknown template ids and non-template requests are refused', async () => {
    const t = mailSenderWelcomeTransport(bindingMailSender({ binding: fakeEmail().binding as never, isSuppressed: async () => false }))
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
