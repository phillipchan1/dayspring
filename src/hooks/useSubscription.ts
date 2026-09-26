import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from './useSession'
import {
  fetchSubscription,
  isEntitledNow,
  readCachedSubscription,
  writeCachedSubscription,
} from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'
import { readCacheOwner } from '@/lib/localData'

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

/** The cached plan, but only if the cache belongs to this account. The seed
 *  is read before App's privacy fence runs, so on a shared browser it could
 *  otherwise briefly be the previous person's plan. */
function cachedFor(ownerId: string | null): Subscription | null {
  if (!ownerId || readCacheOwner() !== ownerId) return null
  return readCachedSubscription()
}

export function useSubscription(): SubscriptionState {
  const { session } = useSession()
  const ownerId = session?.user.id ?? null
  // Seed from the last-known value so a returning user's app paints instantly;
  // the fetch below still runs immediately to reconcile in the background.
  const [subscription, setSubscription] = useState<Subscription | null>(() => cachedFor(ownerId))
  const [loading, setLoading] = useState(() => cachedFor(ownerId) === null)
  const [unreachable, setUnreachable] = useState(false)
  // Whether the value in hand is the server's answer from the latest attempt,
  // rather than the cache standing in for it. See isEntitledNow.
  const [verified, setVerified] = useState(false)
  const mountedRef = useRef(true)
  const ownerRef = useRef(ownerId)
  ownerRef.current = ownerId

  const load = useCallback(async () => {
    try {
      const sub = await fetchSubscription()
      if (mountedRef.current) {
        setSubscription(sub)
        setVerified(true)
        setUnreachable(false)
      }
      writeCachedSubscription(sub)
    } catch {
      // Keep whatever we already have rather than clobbering a real cached
      // entitlement with "no plan" just because one fetch failed. "No plan" is
      // only ever a placeholder for "we have nothing to go on", and that case
      // is flagged unreachable so App offers a retry instead of the paywall.
      if (mountedRef.current) {
        const cached = cachedFor(ownerRef.current)
        setVerified(false)
        setUnreachable((prev) => prev || cached === null)
        setSubscription((prev) => prev ?? cached ?? NO_PLAN)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!session) {
      setLoading(false)
      return () => {
        mountedRef.current = false
      }
    }
    void load()
    return () => {
      mountedRef.current = false
    }
  }, [load, session])

  // Refetch when the window regains focus — catches the case where the user
  // completed checkout on Stripe and returned to the app — and when the
  // connection comes back, so an offline launch reconciles without a relaunch.
  useEffect(() => {
    if (!session) return
    const onWake = () => void load()
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onWake)
    return () => {
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [load, session])

  return {
    subscription,
    entitled: isEntitledNow(subscription, { verified }),
    featureFlags: subscription?.featureFlags ?? [],
    loading,
    unreachable,
    refetch: load,
  }
}
