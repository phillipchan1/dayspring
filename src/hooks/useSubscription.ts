import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSubscription, isEntitled } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'

export interface SubscriptionState {
  subscription: Subscription | null
  entitled: boolean
  featureFlags: string[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useSubscription(): SubscriptionState {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const sub = await fetchSubscription()
      if (mountedRef.current) setSubscription(sub)
    } catch {
      // On error treat as unknown — don't block the app, let them retry
      if (mountedRef.current) setSubscription({ plan: 'none', trial_ends_at: null, plan_expires_at: null })
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
