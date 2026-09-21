import { useEffect, useState } from 'react'
import { startCheckout, trialDaysRemaining } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import { fetchAppleProducts, isAppleIapAvailable, purchaseApple } from '@/lib/appleIap'
import type { Product } from '@spicavi/tauri-plugin-purchases'
import { usesAppStoreCopy } from '@/lib/storeCopy'
import { useTapAction } from '@/lib/tapAction'
import { track } from '@/lib/analytics'
import { displayPrice } from './prices'
import './Paywall.css'

interface Props {
  subscription: Subscription
  /** Dismiss for the rest of this session. */
  onDismiss: () => void
  /** Called after a successful Apple IAP so the parent can refetch entitlement. */
  onPurchased?: () => void
}

/**
 * Persistent, light-touch trial banner. Shown only inside the app (never during
 * onboarding) while plan === 'trialing'. Subscribe goes to StoreKit on iOS and
 * Stripe Checkout elsewhere — no payment form lives in the banner itself.
 */
export function TrialBanner({ subscription, onDismiss, onPurchased }: Props) {
  const [loading, setLoading] = useState(false)
  const days = trialDaysRemaining(subscription)

  const useApple = isAppleIapAvailable()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    track('paywall_seen', { surface: 'trial_banner' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // The banner takes real space in the wide layout rather than floating over
  // the journal's top bar — App Review (4.0, 2026-09-21) saw it collide with
  // the date and word count on iPad. The attribute lets the shell make room.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.trialBanner = ''
    return () => {
      delete root.dataset.trialBanner
    }
  }, [])

  // Subscribe here buys the ANNUAL plan in one tap, so the amount it bills must
  // stand beside it — a price-less Subscribe is what Guideline 3.1.2(c) cited
  // on 2026-09-21. Until StoreKit answers there is no honest figure to show,
  // so there is no button either.
  const annualPrice = displayPrice('annual', { useApple, products })

  async function handleSubscribe() {
    setLoading(true)
    try {
      if (useApple) {
        const { outcome } = await purchaseApple('annual')
        // A double-billing warning is deliberately not surfaced here: the banner
        // has no room for it, and this path is unreachable for a Stripe
        // subscriber anyway (the banner only shows during the app-managed
        // trial, which has no payment source at either store).
        if (outcome === 'purchased') onPurchased?.()
        setLoading(false)
        return
      }
      const url = await startCheckout('annual')
      await openExternal(url, { sameTab: true })
    } catch {
      // Surface nothing intrusive — they can try again from Settings.
      setLoading(false)
    }
  }

  const daysLabel = days === 1 ? '1 day' : `${days} days`
  const subscribeTap = useTapAction(() => void handleSubscribe(), !loading)
  // Beside a StoreKit sheet, "in your trial" reads as the App Store trial these
  // products do not carry. See lib/storeCopy.ts.
  const periodLabel = usesAppStoreCopy() ? 'of complimentary access' : 'in your trial'

  return (
    <div className="trial-banner" role="status">
      <span>
        <span className="trial-banner__days">{daysLabel} left</span> {periodLabel}
      </span>
      {annualPrice && (
        <>
          <span className="trial-banner__price">
            {annualPrice}
            <span className="trial-banner__cadence"> / year</span>
          </span>
          <button
            type="button"
            className="trial-banner__action"
            aria-disabled={loading}
            aria-busy={loading}
            aria-label={`Subscribe yearly — ${annualPrice} per year`}
            {...subscribeTap}
          >
            {loading ? 'Loading…' : 'Subscribe'}
          </button>
        </>
      )}
      <button
        className="trial-banner__dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
