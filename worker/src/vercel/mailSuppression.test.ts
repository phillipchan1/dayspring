// End to end on Postgres (0008 applied): the remind and welcome-drip crons on the
// Worker never send to an address in email_suppressions; the one-click endpoint
// adds one. Mail goes to a fake env.EMAIL binding; Resend is never called.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { openWireSql, type WireSql } from '../testPg.ts'
import { app } from '../index.ts'
import { unsubscribeUrl } from '../../../api/_lib/unsubscribe.ts'

const CRON = 'cron-secret-suppression'
const SECRET = 'test-secret-test-secret-test-secret-32'
const OK = 'supp-test-ok'
const SUP = 'supp-test-sup'
const OK_MAIL = 'ok-supp@example.test'
const SUP_MAIL = 'Sup-Supp@Example.test'

let wire: WireSql
let env: Record<string, unknown>
let sent: Array<Record<string, unknown>>
const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined, props: {} } as never
const cron = (path: string) => app.request(path, { headers: { authorization: `Bearer ${CRON}` } }, env, ctx)

async function reset() {
  const { sql } = wire
  await sql`DELETE FROM "user" WHERE id IN (${OK}, ${SUP})`
  await sql`DELETE FROM public.email_suppressions WHERE email IN (${OK_MAIL}, ${SUP_MAIL.toLowerCase()})`
  await sql`INSERT INTO "user" (id, name, email, created_at) VALUES
    (${OK}, 'Okay', ${OK_MAIL}, now() - interval '1 hour'),
    (${SUP}, 'Sue', ${SUP_MAIL}, now() - interval '1 hour')`
  await sql`INSERT INTO public.email_suppressions (email, source) VALUES (${SUP_MAIL.toLowerCase()}, 'resend')`
}

beforeAll(async () => {
  wire = await openWireSql()
}, 60_000)
beforeEach(async () => {
  await reset()
  sent = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('no network in this test (Resend must not be called)') })
  env = {
    DATABASE_URL: wire.url,
    CRON_SECRET: CRON,
    BETTER_AUTH_SECRET: SECRET,
    BETTER_AUTH_URL: 'http://127.0.0.1:8787',
    ENVIRONMENT: 'local',
    WORKER_MAIL_CRONS: 'on',
    WELCOME_DRIP_SENDS_ENABLED: 'true',
    RESEND_API_KEY: 're_must_not_be_used',
    EMAIL: { send: vi.fn(async (m: Record<string, unknown>) => { sent.push(m); return { messageId: 'm' } }) },
  }
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  if (!wire) return
  await wire.sql`DELETE FROM "user" WHERE id IN (${OK}, ${SUP})`.catch(() => {})
  await wire.sql`DELETE FROM public.email_suppressions WHERE email IN (${OK_MAIL}, ${SUP_MAIL.toLowerCase()})`.catch(() => {})
  await wire.close()
})

const recipients = () => sent.map((m) => String(m.to).trim().toLowerCase())

describe('suppression on the Worker mail crons', () => {
  it('remind: the suppressed owner gets nothing; the control owner gets the reminder', async () => {
    const { sql } = wire
    await sql`INSERT INTO reminders (owner, content, remind_at) VALUES
      (${OK}, 'Be still.', now() - interval '1 minute'),
      (${SUP}, 'Be still.', now() - interval '1 minute')`
    const res = await cron('/api/cron/remind')
    expect(res.status).toBe(200)
    expect(recipients()).toEqual([OK_MAIL])
    expect(sent[0]!.headers).toMatchObject({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })
    expect(recipients()).not.toContain(SUP_MAIL.toLowerCase())
  })

  it('welcome-drip: the suppressed enrollee gets nothing (and is not retried); the control gets day 0', async () => {
    const { sql } = wire
    await sql`INSERT INTO welcome_drip_enrollments (owner, enrolled_at) VALUES (${OK}, now() - interval '1 hour'), (${SUP}, now() - interval '1 hour')`
    const first = await cron('/api/cron/welcome-drip')
    expect(first.status).toBe(200)
    expect(recipients()).toEqual([OK_MAIL])
    expect(String(sent[0]!.text)).toContain('Okay')
    sent.length = 0
    const second = await cron('/api/cron/welcome-drip')
    expect(second.status).toBe(200)
    expect(recipients()).not.toContain(SUP_MAIL.toLowerCase())
  })
})

describe('one-click unsubscribe endpoint', () => {
  it('GET only shows a confirm form; POST (RFC 8058 body) records the address; then remind skips it', async () => {
    const link = new URL(await unsubscribeUrl(OK_MAIL, SECRET))
    const path = `${link.pathname}${link.search}`
    const get = await app.request(path, {}, env, ctx)
    expect(get.status).toBe(200)
    expect(await get.text()).toContain('method="post"')
    expect((await wire.sql`SELECT 1 FROM public.email_suppressions WHERE email = ${OK_MAIL}`).length).toBe(0)

    const post = await app.request(path, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    }, env, ctx)
    expect(post.status).toBe(200)
    const rows = await wire.sql`SELECT source FROM public.email_suppressions WHERE email = ${OK_MAIL}`
    expect(rows.map((r) => r.source)).toEqual(['one-click'])
    // idempotent
    expect((await app.request(path, { method: 'POST' }, env, ctx)).status).toBe(200)

    await wire.sql`INSERT INTO reminders (owner, content, remind_at) VALUES (${OK}, 'x', now() - interval '1 minute')`
    await cron('/api/cron/remind')
    expect(sent).toHaveLength(0)
  })

  it('a tampered or wrong-secret link writes nothing', async () => {
    const link = new URL(await unsubscribeUrl(OK_MAIL, 'some-other-secret'))
    const res = await app.request(`${link.pathname}${link.search}`, { method: 'POST' }, env, ctx)
    expect(res.status).toBe(400)
    const bad = await app.request('/api/email/unsubscribe?e=x&t=y', { method: 'POST' }, env, ctx)
    expect(bad.status).toBe(400)
    expect((await wire.sql`SELECT 1 FROM public.email_suppressions WHERE email = ${OK_MAIL}`).length).toBe(0)
  })
})
