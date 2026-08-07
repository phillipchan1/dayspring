// Client calls for the first-run onboarding flow: the app-managed reverse-trial
// grant and the one-time historical backfill. Both hit user-authed serverless
// endpoints (Bearer <supabase jwt>), so they work cross-origin from the Tauri /
// Capacitor shells as well as same-origin on the web.

import { requireSupabase } from './supabase'
import { apiUrl } from './api'
import { clientContext } from './clientContext'
import type { Plan } from './subscription'

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `request failed (${res.status})`)
  }
  return (await res.json()) as T
}

export interface EnsureProfileResult {
  plan: Plan
  trial_ends_at: string | null
  plan_expires_at: string | null
  onboarded_at: string | null
  /** True when ONBOARDING_REQUIRE_CARD is set server-side (card-first trial). */
  require_card: boolean
}

/**
 * Initialize the account right after auth. Idempotent. In the default
 * (app-managed) model this grants the 14-day reverse trial in Supabase on first
 * sign-in — no Stripe, no card. Returns the resulting plan/trial/onboarded state.
 *
 * Also carries this device's platform/form-factor/timezone/locale, which the
 * server stamps onto the profile alongside the country it reads off the request
 * (see the demographics migration). This call already runs on every app open,
 * so it doubles as the last-seen heartbeat — no extra round trip.
 */
export function ensureProfile(): Promise<EnsureProfileResult> {
  return authedPost<EnsureProfileResult>('/api/profile/ensure', clientContext())
}

export interface RecentBackfillResult {
  status: 'built' | 'skipped'
  period_start: string
  period_end: string
}

/**
 * Trigger the most-recent complete month-in-review on demand (synchronous). This
 * is the Reveal's payload. Reuses the existing server-side rollup builders.
 */
export function backfillRecentMonth(): Promise<RecentBackfillResult> {
  return authedPost<RecentBackfillResult>('/api/onboarding/backfill', { scope: 'recent' })
}

export interface FullBackfillResult {
  status: 'ok'
  done: boolean
  nextCursor: string | null
  built: string[]
}

/**
 * Drive the remainder of the historical backfill in the background. Resumable:
 * each call builds a chunk within a server-side time budget and returns a cursor
 * to continue from. Loops until `done`, then resolves. Best-effort — a failed
 * chunk stops the loop quietly (the daily cron keeps history current going
 * forward, and the user can revisit older reflections as they're built).
 */
export async function backfillFullHistory(
  onProgress?: (built: number) => void,
): Promise<void> {
  let cursor: string | null = null
  let total = 0
  // Hard stop so a pathological case can't loop forever.
  for (let i = 0; i < 200; i++) {
    const res: FullBackfillResult = await authedPost('/api/onboarding/backfill', {
      scope: 'full',
      ...(cursor ? { cursor } : {}),
    })
    total += res.built.length
    onProgress?.(total)
    if (res.done || !res.nextCursor) return
    cursor = res.nextCursor
  }
}
