import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { Environment } from '@apple/app-store-server-library'
import type { Sql } from './db.ts'
import { openWireSql } from './testPg.ts'
import type { Env } from './env.ts'
import { handleStripeWebhook, type StripeBillingClient } from './billing/stripeWebhook.ts'
import { handleAppleWebhook } from './billing/appleWebhook.ts'
import { handleAppleVerify } from './billing/verify.ts'
import { handleStripeCheckout } from './billing/checkout.ts'
import { handleStripePortal } from './billing/portal.ts'
import { handleRevenuecatWebhook } from './billing/revenuecatWebhook.ts'
import type { AppleFns } from './billing/apple.ts'

const WEBHOOK_SECRET = 'whsec_test_dayspring_parity'
const RC_SECRET = 'rc_test_dayspring_parity'
const USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const OTHER = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'

const { retrieveSub, supabaseAdmin, getAuthedUser, appleMocks, appleActual } = vi.hoisted(() => ({
  retrieveSub: vi.fn(),
  supabaseAdmin: vi.fn(),
  getAuthedUser: vi.fn(),
  appleMocks: {
    verifySignedNotification: vi.fn(),
    verifySignedTransaction: vi.fn(),
    resolveAppleSubscription: vi.fn(),
  },
  appleActual: {} as {
    verifySignedNotification: (jws: string) => Promise<unknown>
    verifySignedTransaction: (jws: string) => Promise<unknown>
    resolveAppleSubscription: (id: string, env: unknown) => Promise<unknown>
  },
}))

vi.mock('../../api/_lib/stripe.js', async () => {
  const StripeLib = (await import('stripe')).default
  return {
    stripe: vi.fn(() => ({
      webhooks: StripeLib.webhooks,
      subscriptions: { retrieve: retrieveSub },
    })),
  }
})

vi.mock('../../api/_lib/apple.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/_lib/apple.ts')>()
  appleActual.verifySignedNotification = actual.verifySignedNotification
  appleActual.verifySignedTransaction = actual.verifySignedTransaction
  appleActual.resolveAppleSubscription = actual.resolveAppleSubscription
  appleMocks.verifySignedNotification.mockImplementation((jws: string) =>
    actual.verifySignedNotification(jws),
  )
  appleMocks.verifySignedTransaction.mockImplementation((jws: string) =>
    actual.verifySignedTransaction(jws),
  )
  appleMocks.resolveAppleSubscription.mockImplementation((id, env) =>
    actual.resolveAppleSubscription(id, env),
  )
  return {
    ...actual,
    verifySignedNotification: appleMocks.verifySignedNotification,
    verifySignedTransaction: appleMocks.verifySignedTransaction,
    resolveAppleSubscription: appleMocks.resolveAppleSubscription,
  }
})

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  supabaseAdmin,
}))

vi.mock('../../api/_lib/userAuth.js', () => ({
  getAuthedUser,
  notAuthenticated: () => Response.json({ error: 'not authenticated' }, { status: 401 }),
}))

import { POST as vercelStripeWebhook } from '../../api/webhooks/stripe.ts'
import { POST as vercelAppleWebhook } from '../../api/webhooks/apple.ts'
import { POST as vercelAppleVerify } from '../../api/apple/verify.ts'
import { POST as vercelCheckout } from '../../api/stripe/checkout.ts'
import { GET as vercelPortal } from '../../api/stripe/portal.ts'
import { POST as vercelRevenuecat } from '../../api/webhooks/revenuecat.ts'

const FILTERS = new Set(['owner', 'stripe_customer_id', 'apple_original_txn'])
const COLS = new Set([
  'owner',
  'plan',
  'plan_source',
  'trial_ends_at',
  'plan_expires_at',
  'stripe_customer_id',
  'apple_original_txn',
  'apple_product_id',
  'apple_environment',
  'apple_last_txn_id',
  'apple_updated_at',
])

function iso(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(value)
}

function normalizeRow(row: Record<string, unknown> | null) {
  if (!row) return null
  return {
    plan: row.plan ?? null,
    plan_source: row.plan_source ?? null,
    trial_ends_at: iso(row.trial_ends_at),
    plan_expires_at: iso(row.plan_expires_at),
    stripe_customer_id: row.stripe_customer_id ?? null,
    apple_original_txn: row.apple_original_txn ?? null,
    apple_product_id: row.apple_product_id ?? null,
    apple_environment: row.apple_environment ?? null,
    apple_last_txn_id: row.apple_last_txn_id ?? null,
    apple_updated_at: row.apple_updated_at == null ? null : 'set',
  }
}

function profilesStub(sql: Sql) {
  return {
    from(table: string) {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
      const state: {
        op?: 'select' | 'upsert' | 'update'
        cols?: string
        row?: Record<string, unknown>
        key?: string
        val?: unknown
      } = {}
      const api = {
        select(cols: string) {
          state.op = 'select'
          state.cols = cols
          return api
        },
        upsert(row: Record<string, unknown>) {
          state.op = 'upsert'
          state.row = row
          return api
        },
        update(row: Record<string, unknown>) {
          state.op = 'update'
          state.row = row
          return api
        },
        eq(key: string, val: unknown) {
          state.key = key
          state.val = val
          return api
        },
        async maybeSingle() {
          if (!state.key || !FILTERS.has(state.key)) throw new Error(`bad filter ${state.key}`)
          const cols = (state.cols ?? 'owner')
            .split(',')
            .map((c) => c.trim())
            .filter((c) => COLS.has(c))
          const text = `SELECT ${cols.join(', ')} FROM profiles WHERE ${state.key} = $1 LIMIT 1`
          const rows = (await sql.unsafe(text, [state.val])) as Record<string, unknown>[]
          const data = rows[0]
          if (!data) return { data: null, error: null }
          const out: Record<string, unknown> = { ...data }
          for (const key of ['trial_ends_at', 'plan_expires_at', 'apple_updated_at']) {
            if (key in out) out[key] = iso(out[key])
          }
          return { data: out, error: null }
        },
        async throwOnError() {
          if (state.op === 'upsert' && state.row) {
            const row = state.row
            const keys = Object.keys(row).filter((k) => COLS.has(k))
            const insert = `INSERT INTO profiles (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})
              ON CONFLICT (owner) DO UPDATE SET ${keys
                .filter((k) => k !== 'owner')
                .map((k) => `${k} = EXCLUDED.${k}`)
                .join(', ')}`
            await sql.unsafe(
              insert,
              keys.map((k) => row[k]),
            )
          } else if (state.op === 'update' && state.row && state.key && FILTERS.has(state.key)) {
            const keys = Object.keys(state.row).filter((k) => COLS.has(k))
            const text = `UPDATE profiles SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE ${state.key} = $${keys.length + 1}`
            await sql.unsafe(text, [...keys.map((k) => state.row![k]), state.val])
          }
          return { error: null }
        },
      }
      return api
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { identities: [] } }, error: null }),
      },
    },
  }
}

const billingEnv: Env = {
  STRIPE_SECRET_KEY: 'sk_test_dayspring_parity',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_ANNUAL_PRICE_ID: 'price_annual_test',
  STRIPE_MONTHLY_PRICE_ID: 'price_monthly_test',
  APP_URL: 'https://dayspring-eosin.vercel.app',
  ONBOARDING_REQUIRE_CARD: 'false',
  APPLE_BUNDLE_ID: 'com.phillipchan.dayspring',
  REVENUECAT_WEBHOOK_SECRET: RC_SECRET,
}

function workerStripe(): StripeBillingClient {
  return {
    webhooks: Stripe.webhooks,
    subscriptions: { retrieve: (id: string) => retrieveSub(id) },
  }
}

function signedStripeRequest(event: object): Request {
  const payload = JSON.stringify(event)
  const header = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  })
  return new Request('https://worker.test/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  })
}

const periodEnd = 1_735_689_600

function activeSub(id = 'sub_test_1'): Stripe.Subscription {
  return {
    id,
    object: 'subscription',
    status: 'active',
    customer: 'cus_test_1',
    trial_end: null,
    items: { object: 'list', data: [{ current_period_end: periodEnd } as Stripe.SubscriptionItem], has_more: false, url: '' },
  } as Stripe.Subscription
}

let sql: Sql
let close: () => Promise<void>

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = billingEnv.STRIPE_SECRET_KEY
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.STRIPE_ANNUAL_PRICE_ID = billingEnv.STRIPE_ANNUAL_PRICE_ID
  process.env.STRIPE_MONTHLY_PRICE_ID = billingEnv.STRIPE_MONTHLY_PRICE_ID
  process.env.APP_URL = billingEnv.APP_URL
  process.env.ONBOARDING_REQUIRE_CARD = 'false'
  process.env.REVENUECAT_WEBHOOK_SECRET = RC_SECRET
  const wire = await openWireSql()
  sql = wire.sql
  close = wire.close
})

afterAll(async () => {
  await close?.()
})

async function resetAccounts() {
  await sql`DELETE FROM profiles WHERE owner IN (${USER}, ${OTHER})`
  await sql`DELETE FROM account WHERE user_id IN (${USER}, ${OTHER})`
  await sql`DELETE FROM "user" WHERE id IN (${USER}, ${OTHER})`
  await sql`
    INSERT INTO "user" (id, name, email, email_verified)
    VALUES
      (${USER}, 'Pat', ${`pat-${USER}@example.test`}, TRUE),
      (${OTHER}, 'Other', ${`other-${OTHER}@example.test`}, TRUE)
  `
  await sql`
    INSERT INTO profiles (owner, plan, trial_ends_at)
    VALUES
      (${USER}, 'trialing', ${'2026-12-01T00:00:00.000Z'}),
      (${OTHER}, 'none', ${null})
  `
}

async function profileOf(owner: string) {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT plan, plan_source, trial_ends_at, plan_expires_at, stripe_customer_id,
           apple_original_txn, apple_product_id, apple_environment, apple_last_txn_id, apple_updated_at
    FROM profiles WHERE owner = ${owner}
  `
  return normalizeRow(rows[0] ?? null)
}

async function jsonOf(res: Response) {
  const text = await res.text()
  try {
    return { status: res.status, body: JSON.parse(text) as Record<string, unknown> }
  } catch {
    return { status: res.status, body: { raw: text } }
  }
}

beforeEach(async () => {
  await resetAccounts()
  retrieveSub.mockReset()
  retrieveSub.mockImplementation(async (id: string) => activeSub(id))
  supabaseAdmin.mockReset()
  supabaseAdmin.mockReturnValue(profilesStub(sql))
  getAuthedUser.mockReset()
  getAuthedUser.mockResolvedValue({ id: USER, email: 'pat@example.test' })
  appleMocks.verifySignedNotification.mockReset()
  appleMocks.verifySignedTransaction.mockReset()
  appleMocks.resolveAppleSubscription.mockReset()
  appleMocks.verifySignedNotification.mockImplementation((jws: string) =>
    appleActual.verifySignedNotification(jws) as ReturnType<typeof appleActual.verifySignedNotification>,
  )
  appleMocks.verifySignedTransaction.mockImplementation((jws: string) =>
    appleActual.verifySignedTransaction(jws) as ReturnType<typeof appleActual.verifySignedTransaction>,
  )
  appleMocks.resolveAppleSubscription.mockImplementation((id, env) =>
    appleActual.resolveAppleSubscription(id, env) as ReturnType<typeof appleActual.resolveAppleSubscription>,
  )
})

describe('Stripe webhook parity', () => {
  it('checkout.session.completed writes the same profile row', async () => {
    const event = {
      id: 'evt_cs_1',
      object: 'event',
      type: 'checkout.session.completed',
      created: 1_700_000_000,
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          client_reference_id: USER,
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
        },
      },
    }

    const vercel = await jsonOf(await vercelStripeWebhook(signedStripeRequest(event)))
    const afterVercel = await profileOf(USER)
    await resetAccounts()
    const worker = await jsonOf(
      await handleStripeWebhook(signedStripeRequest(event), sql, billingEnv, undefined, workerStripe()),
    )
    const afterWorker = await profileOf(USER)

    expect(vercel).toEqual({ status: 200, body: { received: true } })
    expect(worker).toEqual(vercel)
    expect(afterWorker).toEqual(afterVercel)
    expect(afterWorker?.plan).toBe('active')
    expect(afterWorker?.plan_source).toBe('stripe')
    expect(afterWorker?.stripe_customer_id).toBe('cus_test_1')
    expect(afterWorker?.plan_expires_at).toBe(new Date(periodEnd * 1000).toISOString())
  })

  it('replays of customer.subscription.updated are idempotent on both sides', async () => {
    await sql`UPDATE profiles SET plan = 'active', plan_source = 'stripe', stripe_customer_id = 'cus_test_1' WHERE owner = ${USER}`
    const event = {
      id: 'evt_sub_1',
      object: 'event',
      type: 'customer.subscription.updated',
      created: 1_700_000_100,
      data: { object: activeSub() },
    }

    const firstV = await jsonOf(await vercelStripeWebhook(signedStripeRequest(event)))
    const rowV1 = await profileOf(USER)
    const secondV = await jsonOf(await vercelStripeWebhook(signedStripeRequest(event)))
    const rowV2 = await profileOf(USER)

    await resetAccounts()
    await sql`UPDATE profiles SET plan = 'active', plan_source = 'stripe', stripe_customer_id = 'cus_test_1' WHERE owner = ${USER}`
    const firstW = await jsonOf(
      await handleStripeWebhook(signedStripeRequest(event), sql, billingEnv, undefined, workerStripe()),
    )
    const rowW1 = await profileOf(USER)
    const secondW = await jsonOf(
      await handleStripeWebhook(signedStripeRequest(event), sql, billingEnv, undefined, workerStripe()),
    )
    const rowW2 = await profileOf(USER)

    expect(firstV).toEqual({ status: 200, body: { received: true } })
    expect(secondV).toEqual(firstV)
    expect(firstW).toEqual(firstV)
    expect(secondW).toEqual(firstV)
    expect(rowV2).toEqual(rowV1)
    expect(rowW2).toEqual(rowW1)
    expect(rowW1).toEqual(rowV1)
  })

  it('rejects a bad Stripe signature on both handlers and writes nothing', async () => {
    const event = {
      id: 'evt_bad',
      object: 'event',
      type: 'checkout.session.completed',
      created: 1_700_000_000,
      data: {
        object: {
          client_reference_id: USER,
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
        },
      },
    }
    const payload = JSON.stringify(event)
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
    const bad = new Request('https://worker.test/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': header.replace(/v1=/, 'v1=dead'), 'content-type': 'application/json' },
      body: payload,
    })
    const before = await profileOf(USER)
    const vercel = await jsonOf(await vercelStripeWebhook(bad.clone()))
    const worker = await jsonOf(
      await handleStripeWebhook(bad, sql, billingEnv, undefined, workerStripe()),
    )
    expect(vercel.status).toBe(400)
    expect(worker.status).toBe(400)
    expect(String(vercel.body.error ?? '')).toMatch(/signature/i)
    expect(String(worker.body.error ?? '')).toMatch(/signature/i)
    expect(await profileOf(USER)).toEqual(before)
  })

  it('invoice.payment_failed stamps past_due with the same expiry', async () => {
    await sql`UPDATE profiles SET plan = 'active', plan_source = 'stripe', stripe_customer_id = 'cus_test_1' WHERE owner = ${USER}`
    const created = 1_700_123_456
    const event = {
      id: 'evt_inv_1',
      object: 'event',
      type: 'invoice.payment_failed',
      created,
      data: {
        object: {
          object: 'invoice',
          customer: 'cus_test_1',
          parent: {
            type: 'subscription_details',
            subscription_details: { subscription: 'sub_test_1' },
          },
        },
      },
    }
    const vercel = await jsonOf(await vercelStripeWebhook(signedStripeRequest(event)))
    const afterVercel = await profileOf(USER)
    await resetAccounts()
    await sql`UPDATE profiles SET plan = 'active', plan_source = 'stripe', stripe_customer_id = 'cus_test_1' WHERE owner = ${USER}`
    const worker = await jsonOf(
      await handleStripeWebhook(signedStripeRequest(event), sql, billingEnv, undefined, workerStripe()),
    )
    const afterWorker = await profileOf(USER)
    expect(vercel.status).toBe(200)
    expect(worker.status).toBe(200)
    expect(afterWorker).toEqual(afterVercel)
    expect(afterWorker?.plan).toBe('past_due')
    expect(afterWorker?.plan_expires_at).toBe(new Date(created * 1000).toISOString())
  })
})

function appleFns(state: {
  originalTransactionId: string
  transactionId: string
  appAccountToken: string | null
  plan: 'active' | 'trialing' | 'cancelled' | 'past_due'
  expiresAt: string
  productId: string
}): AppleFns {
  const txn = {
    originalTransactionId: state.originalTransactionId,
    transactionId: state.transactionId,
    appAccountToken: state.appAccountToken ?? undefined,
  }
  return {
    async verifySignedNotification(jws: string) {
      if (jws === 'a.b.c' || jws === 'garbage') throw new Error('invalid')
      return {
        environment: Environment.SANDBOX,
        payload: {
          notificationType: 'DID_RENEW',
          data: { signedTransactionInfo: 'fixture:txn' },
        },
      }
    },
    async verifySignedTransaction() {
      return { environment: Environment.SANDBOX, transaction: txn }
    },
    async resolveAppleSubscription() {
      return {
        plan: state.plan,
        originalTransactionId: state.originalTransactionId,
        transactionId: state.transactionId,
        productId: state.productId,
        appAccountToken: state.appAccountToken,
        expiresAt: state.expiresAt,
        trialEndsAt: null,
        willRenew: true,
        environment: Environment.SANDBOX,
      }
    },
  }
}

describe('Apple webhook + StoreKit verify parity', () => {
  const expiresAt = '2027-06-01T00:00:00.000Z'
  const appleState = {
    originalTransactionId: '100000000000001',
    transactionId: '200000000000002',
    appAccountToken: USER,
    plan: 'active' as const,
    expiresAt,
    productId: 'dayspring_annual',
  }

  it('rejects an unsigned Apple JWS on both webhook handlers', async () => {
    const req = () =>
      new Request('https://worker.test/api/webhooks/apple', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedPayload: 'a.b.c' }),
      })
    const vercel = await jsonOf(await vercelAppleWebhook(req()))
    const worker = await jsonOf(await handleAppleWebhook(req(), sql, billingEnv, appleFns(appleState)))
    expect(vercel.status).toBe(400)
    expect(worker.status).toBe(400)
    expect(vercel.body.error).toBe('invalid signature')
    expect(worker.body.error).toBe('invalid signature')
  })

  it('DID_RENEW writes the same Apple columns, and a replay does not change them', async () => {
    const fns = appleFns(appleState)
    appleMocks.verifySignedNotification.mockImplementation(fns.verifySignedNotification)
    appleMocks.verifySignedTransaction.mockImplementation(fns.verifySignedTransaction)
    appleMocks.resolveAppleSubscription.mockImplementation(fns.resolveAppleSubscription)

    const req = () =>
      new Request('https://worker.test/api/webhooks/apple', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedPayload: 'fixture.apple.jws' }),
      })

    const vercel1 = await jsonOf(await vercelAppleWebhook(req()))
    const vercelRow1 = await profileOf(USER)
    const vercel2 = await jsonOf(await vercelAppleWebhook(req()))
    const vercelRow2 = await profileOf(USER)

    await resetAccounts()
    const worker1 = await jsonOf(await handleAppleWebhook(req(), sql, billingEnv, fns))
    const workerRow1 = await profileOf(USER)
    const worker2 = await jsonOf(await handleAppleWebhook(req(), sql, billingEnv, fns))
    const workerRow2 = await profileOf(USER)

    expect(vercel1).toEqual({ status: 200, body: { received: true } })
    expect(vercel2).toEqual(vercel1)
    expect(worker1).toEqual(vercel1)
    expect(worker2).toEqual(vercel1)
    expect(vercelRow2).toEqual(vercelRow1)
    expect(workerRow2).toEqual(workerRow1)
    expect(workerRow1).toEqual(vercelRow1)
    expect(workerRow1?.plan).toBe('active')
    expect(workerRow1?.plan_source).toBe('apple')
    expect(workerRow1?.apple_original_txn).toBe('100000000000001')
    expect(workerRow1?.apple_environment).toBe('Sandbox')
  })

  it('StoreKit verify returns the same body and row', async () => {
    const fns = appleFns(appleState)
    appleMocks.verifySignedNotification.mockImplementation(fns.verifySignedNotification)
    appleMocks.verifySignedTransaction.mockImplementation(fns.verifySignedTransaction)
    appleMocks.resolveAppleSubscription.mockImplementation(fns.resolveAppleSubscription)

    const req = () =>
      new Request('https://worker.test/api/apple/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
        body: JSON.stringify({ jws: 'fixture.storekit.jws' }),
      })

    const vercel = await jsonOf(await vercelAppleVerify(req()))
    const vercelRow = await profileOf(USER)
    await resetAccounts()
    const worker = await jsonOf(await handleAppleVerify(req(), sql, billingEnv, { id: USER }, fns))
    const workerRow = await profileOf(USER)

    expect(worker.status).toBe(vercel.status)
    expect(worker.body).toEqual(vercel.body)
    expect(workerRow).toEqual(vercelRow)
    expect(worker.body.applied).toBe(true)
    expect(worker.body.entitled).toBe(true)
    expect(worker.body.plan).toBe('active')
  })

  it('rejects a bad StoreKit JWS on both verify handlers', async () => {
    const fns = appleFns(appleState)
    appleMocks.verifySignedTransaction.mockImplementation(async (jws: string) => {
      if (jws === 'a.b.c') throw new Error('invalid')
      return fns.verifySignedTransaction(jws)
    })
    const req = () =>
      new Request('https://worker.test/api/apple/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
        body: JSON.stringify({ jws: 'a.b.c' }),
      })
    const vercel = await jsonOf(await vercelAppleVerify(req()))
    const worker = await jsonOf(
      await handleAppleVerify(req(), sql, billingEnv, { id: USER }, {
        ...fns,
        verifySignedTransaction: async () => {
          throw new Error('invalid')
        },
      }),
    )
    expect(vercel.status).toBe(400)
    expect(worker.status).toBe(400)
    expect(vercel.body.error).toBe('invalid transaction')
    expect(worker.body.error).toBe('invalid transaction')
  })
})

describe('Checkout and portal parity', () => {
  it('blocks Stripe checkout while Apple may still charge, same 409 body', async () => {
    await sql`
      UPDATE profiles
      SET plan = 'active', plan_source = 'apple', apple_original_txn = '1001',
          plan_expires_at = ${'2026-06-01T00:00:00.000Z'}
      WHERE owner = ${USER}
    `
    const stripeCheckout = {
      checkout: {
        sessions: {
          create: vi.fn(async () => ({ url: 'https://checkout.stripe.test/c' })),
        },
      },
    }
    const req = () =>
      new Request('https://worker.test/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
        body: JSON.stringify({ plan: 'annual' }),
      })

    const { stripe } = await import('../../api/_lib/stripe.js')
    vi.mocked(stripe).mockReturnValue({
      webhooks: Stripe.webhooks,
      subscriptions: { retrieve: retrieveSub },
      checkout: stripeCheckout.checkout,
    } as never)

    const vercel = await jsonOf(await vercelCheckout(req()))
    const worker = await jsonOf(
      await handleStripeCheckout(req(), sql, billingEnv, { id: USER, email: 'pat@example.test' }, stripeCheckout),
    )
    expect(vercel.status).toBe(409)
    expect(worker.status).toBe(409)
    expect(worker.body).toEqual(vercel.body)
    expect(worker.body.code).toBe('managed_by_apple')
    expect(stripeCheckout.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('opens a portal session from the same customer id', async () => {
    await sql`UPDATE profiles SET stripe_customer_id = 'cus_test_1' WHERE owner = ${USER}`
    const portal = {
      billingPortal: {
        sessions: {
          create: vi.fn(async (params: { customer: string }) => {
            expect(params.customer).toBe('cus_test_1')
            return { url: 'https://billing.stripe.test/p' }
          }),
        },
      },
    }
    const { stripe } = await import('../../api/_lib/stripe.js')
    vi.mocked(stripe).mockReturnValue({
      webhooks: Stripe.webhooks,
      subscriptions: { retrieve: retrieveSub },
      billingPortal: portal.billingPortal,
    } as never)

    const req = () =>
      new Request('https://worker.test/api/stripe/portal', {
        method: 'GET',
        headers: { authorization: 'Bearer test' },
      })
    const vercel = await jsonOf(await vercelPortal(req()))
    const worker = await jsonOf(await handleStripePortal(sql, billingEnv, { id: USER }, portal))
    expect(vercel).toEqual({ status: 200, body: { url: 'https://billing.stripe.test/p' } })
    expect(worker).toEqual(vercel)
  })
})

const RC_EXPIRES_MS = Date.parse('2027-06-01T00:00:00.000Z')

function rcRenewal() {
  return {
    event: {
      type: 'RENEWAL',
      app_user_id: USER,
      expiration_at_ms: RC_EXPIRES_MS,
      period_type: 'NORMAL',
      original_transaction_id: '1001',
      transaction_id: '1002',
    },
  }
}

function rcRequest(body: object, authorization: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authorization != null) headers.authorization = authorization
  return new Request('https://worker.test/api/webhooks/revenuecat', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('RevenueCat webhook parity', () => {
  it('authorized RENEWAL writes the same profile row', async () => {
    const req = () => rcRequest(rcRenewal(), `Bearer ${RC_SECRET}`)
    const vercel = await jsonOf(await vercelRevenuecat(req()))
    const afterVercel = await profileOf(USER)
    await resetAccounts()
    const worker = await jsonOf(await handleRevenuecatWebhook(req(), sql, billingEnv))
    const afterWorker = await profileOf(USER)

    expect(vercel).toEqual({ status: 200, body: { received: true } })
    expect(worker).toEqual(vercel)
    expect(afterWorker).toEqual(afterVercel)
    expect(afterWorker?.plan).toBe('active')
    expect(afterWorker?.plan_source).toBe('apple')
    expect(afterWorker?.apple_original_txn).toBe('1001')
    expect(afterWorker?.plan_expires_at).toBe(new Date(RC_EXPIRES_MS).toISOString())
  })

  it('returns 401 when the secret is missing or wrong and writes nothing', async () => {
    const before = await profileOf(USER)
    const wrong = rcRequest(rcRenewal(), 'Bearer nope')
    const vercelWrong = await jsonOf(await vercelRevenuecat(wrong.clone()))
    const workerWrong = await jsonOf(await handleRevenuecatWebhook(wrong, sql, billingEnv))

    const prev = process.env.REVENUECAT_WEBHOOK_SECRET
    delete process.env.REVENUECAT_WEBHOOK_SECRET
    const vercelNoSecret = await jsonOf(await vercelRevenuecat(rcRequest(rcRenewal(), `Bearer ${RC_SECRET}`)))
    process.env.REVENUECAT_WEBHOOK_SECRET = prev
    const workerNoSecret = await jsonOf(
      await handleRevenuecatWebhook(rcRequest(rcRenewal(), `Bearer ${RC_SECRET}`), sql, {
        ...billingEnv,
        REVENUECAT_WEBHOOK_SECRET: undefined,
      }),
    )

    expect(vercelWrong).toEqual({ status: 401, body: { error: 'unauthorized' } })
    expect(workerWrong).toEqual(vercelWrong)
    expect(vercelNoSecret).toEqual(vercelWrong)
    expect(workerNoSecret).toEqual(vercelWrong)
    expect(await profileOf(USER)).toEqual(before)
  })

  it('replays of an authorized RENEWAL are idempotent on both sides', async () => {
    const req = () => rcRequest(rcRenewal(), `Bearer ${RC_SECRET}`)
    const firstV = await jsonOf(await vercelRevenuecat(req()))
    const rowV1 = await profileOf(USER)
    const secondV = await jsonOf(await vercelRevenuecat(req()))
    const rowV2 = await profileOf(USER)

    await resetAccounts()
    const firstW = await jsonOf(await handleRevenuecatWebhook(req(), sql, billingEnv))
    const rowW1 = await profileOf(USER)
    const secondW = await jsonOf(await handleRevenuecatWebhook(req(), sql, billingEnv))
    const rowW2 = await profileOf(USER)

    expect(firstV).toEqual({ status: 200, body: { received: true } })
    expect(secondV).toEqual(firstV)
    expect(firstW).toEqual(firstV)
    expect(secondW).toEqual(firstV)
    expect(rowV2).toEqual(rowV1)
    expect(rowW2).toEqual(rowW1)
    expect(rowW1).toEqual(rowV1)
  })
})
