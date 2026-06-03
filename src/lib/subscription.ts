import { requireSupabase } from './supabase'
import { apiUrl } from './api'

export type Plan = 'none' | 'trialing' | 'active' | 'cancelled' | 'past_due'

export interface Subscription {
  plan: Plan
  trial_ends_at: string | null
  plan_expires_at: string | null
  is_beta: boolean
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
    .select('plan, trial_ends_at, plan_expires_at, is_beta')
    .maybeSingle()

  if (error) throw error

  return {
    plan: (data?.plan as Plan | null) ?? 'none',
    trial_ends_at: data?.trial_ends_at ?? null,
    plan_expires_at: data?.plan_expires_at ?? null,
    is_beta: data?.is_beta ?? false,
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
