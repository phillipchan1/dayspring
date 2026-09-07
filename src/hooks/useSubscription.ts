import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSubscription, isEntitled, readCachedSubscription, writeCachedSubscription } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'

export interface SubscriptionState {
  subscription: Subscription | null
  entitled: boolean
  featureFlags: string[]
  loading: boolean
  /**
   * True when we have never successfully read this account's subscription and
   * the last attempt failed — offline, or the API is down.
   *
   * This is NOT the same as "no plan", and the difference matters: showing
   * someone the "your trial has ended" screen because their wifi dropped is a
   * lie about their account, and the buttons on it cannot work either. Callers
   * should offer a retry instead. Once a value has been read (or restored from
   * cache) this stays false and the cached plan governs, so a paying user who
   * goes offline keeps writing.
   */
  unreachable: boolean
  refetch: () => Promise<void>
}

const NO_PLAN: Subscription = {
  plan: 'none',
  plan_source: null,
  trial_ends_at: null,
  plan_expires_at: null,
  onboarded_at: null,
  featureFlags: [],
}

export function useSubscription(): SubscriptionState {
  // Seed from the last-known value so a returning user's app paints instantly;
  // the fetch below still runs immediately to reconcile in the background.
  const [subscription, setSubscription] = useState<Subscription | null>(readCachedSubscription)
  const [loading, setLoading] = useState(() => readCachedSubscription() === null)
  const [unreachable, setUnreachable] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const sub = await fetchSubscription()
      if (mountedRef.current) {
        setSubscription(sub)
        setUnreachable(false)
      }
      writeCachedSubscription(sub)
    } catch {
      // Keep whatever we already have (cached or null) rather than clobbering a
      // real cached entitlement with "no plan" just because one fetch failed.
      if (mountedRef.current) {
        setUnreachable((prev) => prev || subscriptionUnknown())
        setSubscription((prev) => prev ?? NO_PLAN)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  /** Only flag unreachable when we genuinely have nothing to go on — a cached
   *  subscription means the app can carry on and reconcile later. */
  function subscriptionUnknown(): boolean {
    return readCachedSubscription() === null
  }

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
    unreachable,
    refetch: load,
  }
}
