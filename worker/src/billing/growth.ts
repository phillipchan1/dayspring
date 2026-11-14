// Worker copy of api/_lib/growthEvents.ts send path: same events, same payloads.
// waitUntil comes from the Worker request; email is looked up on "user".
import { createHash } from 'node:crypto'
import type { Plan, PlanSource } from '../../../api/_lib/entitlement.ts'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import type { CurrentPlanRow, SubscriptionUpdate } from './guard.ts'

export type WaitUntil = (task: Promise<unknown>) => void
export type LifecycleEvent = 'StartTrial' | 'Purchase' | 'Cancel'

const POSTHOG_EVENT: Record<LifecycleEvent, string> = {
  StartTrial: 'trial_started',
  Purchase: 'subscription_purchased',
  Cancel: 'subscription_cancelled',
}

const PLAN_AFTER: Record<LifecycleEvent, 'trialing' | 'active' | 'cancelled'> = {
  StartTrial: 'trialing',
  Purchase: 'active',
  Cancel: 'cancelled',
}

export function lifecycleEventFor(current: Plan | null, next: Plan): LifecycleEvent | null {
  const prev = current ?? 'none'
  if (prev === next) return null
  if (next === 'trialing') return prev === 'active' ? null : 'StartTrial'
  if (next === 'active') return 'Purchase'
  if (next === 'cancelled') {
    return prev === 'active' || prev === 'trialing' || prev === 'past_due' ? 'Cancel' : null
  }
  return null
}

function postHogLifecycleProperties(params: {
  event: LifecycleEvent
  source: PlanSource
}): {
  source: PlanSource
  $lib: 'dayspring-server'
  $set: { plan: 'trialing' | 'active' | 'cancelled'; store: PlanSource }
} {
  return {
    source: params.source,
    $lib: 'dayspring-server',
    $set: { plan: PLAN_AFTER[params.event], store: params.source },
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

async function lookupEmail(sql: Sql, userId: string): Promise<string | null> {
  try {
    const rows = await sql<{ email: string | null }[]>`
      SELECT email FROM "user" WHERE id = ${userId} LIMIT 1
    `
    return rows[0]?.email ?? null
  } catch {
    return null
  }
}

async function sendLifecycleEvent(
  env: Env,
  sql: Sql,
  params: { userId: string; event: LifecycleEvent; source: PlanSource },
): Promise<void> {
  const posthogKey = env.VITE_POSTHOG_KEY?.trim() || null
  const posthogHost = (env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(/\/$/, '')
  const pixelId = env.META_PIXEL_ID?.trim() || null
  const metaToken = env.META_CAPI_ACCESS_TOKEN?.trim() || null
  if (!posthogKey && !(pixelId && metaToken)) return

  const email = pixelId && metaToken ? await lookupEmail(sql, params.userId) : null
  const eventTimeSec = Math.floor(Date.now() / 1000)
  const sends: Promise<void>[] = []

  if (posthogKey) {
    sends.push(
      fetch(`${posthogHost}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: posthogKey,
          event: POSTHOG_EVENT[params.event],
          distinct_id: params.userId,
          properties: postHogLifecycleProperties(params),
          timestamp: new Date(eventTimeSec * 1000).toISOString(),
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`PostHog capture ${res.status}`)
      }),
    )
  }

  if (pixelId && metaToken) {
    sends.push(
      fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(metaToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [
              {
                event_name: params.event,
                event_time: eventTimeSec,
                action_source: 'system_generated',
                user_data: {
                  external_id: sha256(params.userId),
                  ...(email ? { em: [sha256(email)] } : {}),
                },
              },
            ],
          }),
        },
      ).then(async (res) => {
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          throw new Error(`Meta CAPI ${res.status}: ${detail.slice(0, 300)}`)
        }
      }),
    )
  }

  await Promise.all(sends)
}

export function emitLifecycleEvent(
  env: Env,
  sql: Sql,
  waitUntil: WaitUntil | undefined,
  userId: string | undefined,
  current: CurrentPlanRow | null,
  update: Pick<SubscriptionUpdate, 'plan' | 'source'>,
): void {
  if (!userId) return
  const event = lifecycleEventFor(current?.plan ?? null, update.plan)
  if (!event) return
  const run = sendLifecycleEvent(env, sql, {
    userId,
    event,
    source: update.source,
  }).catch((e) => {
    console.error(`[growth] ${event} (${update.source}) failed`, e)
  })
  if (waitUntil) {
    try {
      waitUntil(run)
      return
    } catch {
      // waitUntil is only valid inside a request.
    }
  }
  void run
}
