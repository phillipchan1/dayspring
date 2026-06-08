import { requireSupabase } from './supabase'
import { apiUrl } from './api'

export type Plan = 'none' | 'trialing' | 'active' | 'cancelled' | 'past_due'

export interface Subscription {
  plan: Plan
  trial_ends_at: string | null
  plan_expires_at: string | null
  /** Null until the user finishes (or skips) the first-run onboarding flow. */
  onboarded_at: string | null
  featureFlags: string[]
}

export function isEntitled(sub: Subscription | null): boolean {
  if (!sub) return false
  if (sub.plan === 'active') return true
  if (sub.plan === 'trialing' && sub.trial_ends_at) {
    return new Date(sub.trial_ends_at) > new Date()
  }
  return false
}

export function trialDaysRemaining(sub: Subscription | null): number {
  if (!sub?.trial_ends_at) return 0
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/** Fetch the current user's subscription state from their profile row. */
export async function fetchSubscription(): Promise<Subscription> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('plan, trial_ends_at, plan_expires_at, onboarded_at, feature_flags')
    .maybeSingle()

  if (error) throw error

  return {
    plan: (data?.plan as Plan | null) ?? 'none',
    trial_ends_at: data?.trial_ends_at ?? null,
    plan_expires_at: data?.plan_expires_at ?? null,
    onboarded_at: data?.onboarded_at ?? null,
    featureFlags: (data?.feature_flags as string[] | null) ?? [],
  }
}

/** POST to /api/stripe/checkout and return the Stripe-hosted checkout URL. */
export async function startCheckout(plan: 'annual' | 'monthly'): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/stripe/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `checkout failed (${res.status})`)
  }

  const { url } = (await res.json()) as { url: string }
  return url
}

/** POST /api/trial/extend — one-time +7 day self-serve extension. */
export async function extendTrial(): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/trial/extend'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `extend failed (${res.status})`)
  }
}

/** What Dayspring is holding for this user — the personal value anchor. */
export interface JournalHolding {
  entries: number
  years: number
  prayers: number
  scriptures: number
}

export async function fetchJournalHolding(): Promise<JournalHolding> {
  const sb = requireSupabase()
  const head = { count: 'exact' as const, head: true }
  const [entriesRes, firstRes, prayersRes, scripturesRes] = await Promise.all([
    sb.from('entries').select('id', head),
    sb
      .from('entries')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb.from('spiritual_items').select('id', head).eq('type', 'prayer'),
    sb.from('scripture_refs').select('id', head),
  ])
  const entries = entriesRes.count ?? 0
  const first = firstRes.data?.created_at ? new Date(firstRes.data.created_at) : null
  const years = first
    ? Math.max(1, Math.round((Date.now() - first.getTime()) / (365.25 * 864e5)))
    : 0
  return {
    entries,
    years,
    prayers: prayersRes.count ?? 0,
    scriptures: scripturesRes.count ?? 0,
  }
}

/** GET /api/stripe/portal and return the Stripe Customer Portal URL. */
export async function fetchPortalUrl(): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/stripe/portal'), {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `portal failed (${res.status})`)
  }

  const { url } = (await res.json()) as { url: string }
  return url
}
