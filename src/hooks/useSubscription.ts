import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSubscription, isEntitled, readCachedSubscription, writeCachedSubscription } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'

export interface SubscriptionState {
  subscription: Subscription | null
  entitled: boolean
  featureFlags: string[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useSubscription(): SubscriptionState {
  // Seed from the last-known value so a returning user's app paints instantly;
  // the fetch below still runs immediately to reconcile in the background.
  const [subscription, setSubscription] = useState<Subscription | null>(readCachedSubscription)
  const [loading, setLoading] = useState(() => readCachedSubscription() === null)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const sub = await fetchSubscription()
      if (mountedRef.current) setSubscription(sub)
      writeCachedSubscription(sub)
    } catch {
      // On error, keep whatever we already have (cached or null) rather than
      // clobbering a real cached entitlement with "no plan" just because a
      // single fetch failed (e.g. offline).
      if (mountedRef.current) {
        setSubscription((prev) => prev ?? { plan: 'none', trial_ends_at: null, plan_expires_at: null, onboarded_at: null, featureFlags: [] })
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void load()
    return () => {
      mountedRef.current = false
    }
  }, [load])

  // Refetch when the window regains focus — catches the case where the user
  // completed checkout on Stripe and returned to the app.
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  return {
    subscription,
    entitled: isEntitled(subscription),
    featureFlags: subscription?.featureFlags ?? [],
    loading,
    refetch: load,
  }
}
