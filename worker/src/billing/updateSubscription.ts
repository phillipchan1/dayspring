import type { Plan, PlanSource } from '../../../api/_lib/entitlement.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import {
  logSkip,
  shouldApplyUpdate,
  updateColumns,
  type CurrentPlanRow,
  type SubscriptionUpdate,
  type WriteOutcome,
} from './guard.ts'
import { emitLifecycleEvent, type WaitUntil } from './growth.ts'

export type { CurrentPlanRow, SubscriptionUpdate, WriteOutcome }

const BILLING_COLUMN = new Set([
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

export interface BillingWriteCtx {
  sql: Sql
  env: Env
  waitUntil?: WaitUntil
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(value)
}

function asPlan(value: unknown): Plan {
  if (
    value === 'none' ||
    value === 'trialing' ||
    value === 'active' ||
    value === 'cancelled' ||
    value === 'past_due'
  ) {
    return value
  }
  return 'none'
}

function asSource(value: unknown): PlanSource | null {
  return value === 'stripe' || value === 'apple' ? value : null
}

function toCurrent(row: Record<string, unknown> | null | undefined): CurrentPlanRow | null {
  if (!row) return null
  return {
    plan: asPlan(row.plan),
    plan_source: asSource(row.plan_source),
    trial_ends_at: isoOrNull(row.trial_ends_at),
    plan_expires_at: isoOrNull(row.plan_expires_at),
    owner: typeof row.owner === 'string' ? row.owner : undefined,
  }
}

function writeCols(update: SubscriptionUpdate): Record<string, unknown> {
  const cols = updateColumns(update)
  for (const key of Object.keys(cols)) {
    if (!BILLING_COLUMN.has(key)) throw new Error(`refusing billing column ${key}`)
  }
  return cols
}

export async function profileExists(sql: Sql, owner: string): Promise<boolean> {
  const rows = await sql<{ owner: string }[]>`
    SELECT owner FROM profiles WHERE owner = ${owner} LIMIT 1
  `
  return rows[0] != null
}

export async function ownerByAppleOriginalTxn(
  sql: Sql,
  originalTransactionId: string,
): Promise<string | null> {
  const rows = await sql<{ owner: string }[]>`
    SELECT owner FROM profiles WHERE apple_original_txn = ${originalTransactionId} LIMIT 1
  `
  return rows[0]?.owner ?? null
}

export async function planStateByOwner(sql: Sql, owner: string): Promise<{
  plan: Plan
  plan_source: PlanSource | null
  trial_ends_at: string | null
  plan_expires_at: string | null
  stripe_customer_id: string | null
} | null> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT plan, plan_source, trial_ends_at, plan_expires_at, stripe_customer_id
    FROM profiles
    WHERE owner = ${owner}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    plan: asPlan(row.plan),
    plan_source: asSource(row.plan_source),
    trial_ends_at: isoOrNull(row.trial_ends_at),
    plan_expires_at: isoOrNull(row.plan_expires_at),
    stripe_customer_id: typeof row.stripe_customer_id === 'string' ? row.stripe_customer_id : null,
  }
}

export async function signInProvidersFor(sql: Sql, userId: string): Promise<string[]> {
  try {
    const rows = await sql<{ provider_id: string }[]>`
      SELECT provider_id FROM account WHERE user_id = ${userId}
    `
    return rows.map((r) => r.provider_id).filter((p) => p === 'google' || p === 'apple')
  } catch {
    return []
  }
}

export async function updateSubscriptionByUserId(
  ctx: BillingWriteCtx,
  userId: string,
  update: SubscriptionUpdate,
): Promise<WriteOutcome> {
  const currentRows = await ctx.sql<Record<string, unknown>[]>`
    SELECT plan, plan_source, trial_ends_at, plan_expires_at, owner
    FROM profiles
    WHERE owner = ${userId}
    LIMIT 1
  `
  const current = toCurrent(currentRows[0])

  if (!shouldApplyUpdate(current, update)) {
    logSkip(`owner ${userId}`, update, current!)
    return 'stale-cross-store'
  }

  const cols = writeCols(update)
  const row = { owner: userId, ...cols }
  await ctx.sql`INSERT INTO profiles ${ctx.sql(row)} ON CONFLICT (owner) DO UPDATE SET ${ctx.sql(cols)}`
  emitLifecycleEvent(ctx.env, ctx.sql, ctx.waitUntil, userId, current, update)
  return 'applied'
}

export async function updateSubscriptionByStripeCustomer(
  ctx: BillingWriteCtx,
  stripeCustomerId: string,
  update: Omit<SubscriptionUpdate, 'stripe_customer_id'>,
): Promise<WriteOutcome> {
  const currentRows = await ctx.sql<Record<string, unknown>[]>`
    SELECT plan, plan_source, trial_ends_at, plan_expires_at, owner
    FROM profiles
    WHERE stripe_customer_id = ${stripeCustomerId}
    LIMIT 1
  `
  const current = toCurrent(currentRows[0])
  if (!current) return 'no-match'

  if (!shouldApplyUpdate(current, update)) {
    logSkip(`stripe customer ${stripeCustomerId}`, update, current)
    return 'stale-cross-store'
  }

  const cols = writeCols(update)
  await ctx.sql`
    UPDATE profiles SET ${ctx.sql(cols)} WHERE stripe_customer_id = ${stripeCustomerId}
  `
  emitLifecycleEvent(ctx.env, ctx.sql, ctx.waitUntil, current.owner, current, update)
  return 'applied'
}

export async function updateSubscriptionByAppleOriginalTxn(
  ctx: BillingWriteCtx,
  originalTransactionId: string,
  update: Omit<SubscriptionUpdate, 'stripe_customer_id'>,
): Promise<WriteOutcome> {
  const currentRows = await ctx.sql<Record<string, unknown>[]>`
    SELECT plan, plan_source, trial_ends_at, plan_expires_at, owner
    FROM profiles
    WHERE apple_original_txn = ${originalTransactionId}
    LIMIT 1
  `
  const current = toCurrent(currentRows[0])
  if (!current) return 'no-match'

  if (!shouldApplyUpdate(current, update)) {
    logSkip(`apple txn ${originalTransactionId}`, update, current)
    return 'stale-cross-store'
  }

  const cols = writeCols(update)
  await ctx.sql`
    UPDATE profiles SET ${ctx.sql(cols)} WHERE apple_original_txn = ${originalTransactionId}
  `
  emitLifecycleEvent(ctx.env, ctx.sql, ctx.waitUntil, current.owner, current, update)
  return 'applied'
}
