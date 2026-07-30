import { useEffect, useState } from 'react'
import { Brand } from '@/components/Mark'
import { startCheckout } from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import {
  fetchAppleProducts,
  isAppleIapAvailable,
  purchaseApple,
  restoreApplePurchases,
  type ApplePlan,
} from '@/lib/appleIap'
import type { Product } from '@spicavi/tauri-plugin-purchases'
import { AppleSubscriptionTerms } from './AppleSubscriptionTerms'
import './Paywall.css'

export function PaywallScreen({ onPurchased }: { onPurchased?: () => void } = {}) {
  const useApple = isAppleIapAvailable()
  const [loading, setLoading] = useState<'annual' | 'monthly' | 'restore' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!useApple) return
    let alive = true
    fetchAppleProducts().then(
      (list) => alive && setProducts(list),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [useApple])

  async function handleSelect(plan: ApplePlan) {
    setError(null)
    setLoading(plan)
    try {
      if (useApple) {
        const outcome = await purchaseApple(plan)
        if (outcome === 'cancelled') {
          setLoading(null)
          return
        }
        if (outcome === 'pending') {
          setError('Purchase is pending approval. You’ll get access once it’s approved.')
          setLoading(null)
          return
        }
        onPurchased?.()
        return
      }
      const url = await startCheckout(plan)
      await openExternal(url, { sameTab: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  async function handleRestore() {
    setError(null)
    setLoading('restore')
    try {
      const n = await restoreApplePurchases()
      if (n === 0) {
        setError('No purchases found for this Apple ID.')
        setLoading(null)
        return
      }
      onPurchased?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore purchases.')
      setLoading(null)
    }
  }

  const busy = loading !== null
  const annual = products.find((p) => p.id.includes('annual'))
  const monthly = products.find((p) => p.id.includes('monthly'))

  return (
    <div className="paywall">
      <div className="paywall__glow" aria-hidden />
      <div className="paywall__content">
        <div className="paywall__mark">
          <Brand size={34} wordmarkRem={2} />
        </div>

        <p className="paywall__tagline">the dayspring from on high.</p>

        {/* The headline must not promise a free trial on the Apple path: the
            14 days were already granted in-app, and the App Store products
            carry no introductory offer, so choosing a plan here charges today.
            Guideline 3.1.2 treats a trial promise that StoreKit won't honour as
            inaccurate pricing — and it would be a broken promise regardless. */}
        <h1 className="paywall__headline">
          {useApple ? 'Keep your journal going' : 'Begin your 14-day free trial'}
        </h1>

        <p className="paywall__sub">
          Your journal history is the whole point — everything compounds over time.
        </p>

        <div className="paywall__plans">
          <button
            className="paywall__plan"
            data-recommended="true"
            disabled={busy}
            onClick={() => void handleSelect('annual')}
            aria-label={`Start annual plan — ${annual?.displayPrice ?? '$64'} per year`}
          >
            <span className="paywall__plan-badge">Best value</span>
            <span className="paywall__plan-price">{annual?.displayPrice ?? '$64'}</span>
            <span className="paywall__plan-cadence">per year</span>
            {/* The "~$5.33 / month" breakdown is derived from the US price. When
                StoreKit supplies the price it may be in any storefront currency,
                and a hardcoded dollar figure beside it would be simply wrong —
                which Apple treats as inaccurate pricing, not a rounding quibble. */}
            <span className="paywall__plan-note">
              {useApple && annual?.displayPrice
                ? 'Value compounds over time'
                : '~$5.33 / month · value compounds over time'}
            </span>
          </button>

          <button
            className="paywall__plan"
            disabled={busy}
            onClick={() => void handleSelect('monthly')}
            aria-label={`Start monthly plan — ${monthly?.displayPrice ?? '$7'} per month`}
          >
            <span className="paywall__plan-price">{monthly?.displayPrice ?? '$7'}</span>
            <span className="paywall__plan-cadence">per month</span>
            <span className="paywall__plan-note">Cancel anytime</span>
          </button>
        </div>

        {/* On Apple the 14-day trial has ALREADY been granted in-app (the
            app-managed reverse trial), so unless a StoreKit introductory offer
            is configured, choosing a plan here charges immediately. Promising
            "no charge today" on that path would be untrue to the user and
            inaccurate pricing to App Review. */}
        <p className="paywall__trial-note">
          {useApple ? (
            <>Your plan starts today and renews automatically. Cancel anytime in Settings.</>
          ) : (
            <>
              <strong>14 days free,</strong> no charge today. Choose your plan to start — you can
              switch or cancel before the trial ends.
            </>
          )}
        </p>

        {useApple && (
          <button
            className="btn btn--ghost"
            style={{ marginBottom: '0.75rem' }}
            disabled={busy}
            onClick={() => void handleRestore()}
          >
            {loading === 'restore' ? 'Restoring…' : 'Restore purchases'}
          </button>
        )}

        {loading && loading !== 'restore' && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {useApple ? 'Confirming with the App Store…' : 'Redirecting to checkout…'}
          </p>
        )}

        {error && <p className="paywall__error">{error}</p>}

        {useApple && <AppleSubscriptionTerms />}
      </div>
    </div>
  )
}
