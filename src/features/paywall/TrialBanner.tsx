import { useState } from 'react'
import { startCheckout, trialDaysRemaining } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import { isAppleIapAvailable, purchaseApple } from '@/lib/appleIap'
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

  async function handleSubscribe() {
    setLoading(true)
    try {
      if (isAppleIapAvailable()) {
        const outcome = await purchaseApple('annual')
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

  return (
    <div className="trial-banner" role="status">
      <span>
        <span className="trial-banner__days">{daysLabel} left</span> in your trial
      </span>
      <button
        className="trial-banner__action"
        onClick={() => void handleSubscribe()}
        disabled={loading}
      >
        {loading ? 'Loading…' : 'Subscribe'}
      </button>
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
