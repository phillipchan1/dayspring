import { useState } from 'react'
import { startCheckout, trialDaysRemaining } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'
import './Paywall.css'

interface Props {
  subscription: Subscription
  /** Dismiss for the rest of this session. */
  onDismiss: () => void
}

/**
 * Persistent, light-touch trial banner. Shown only inside the app (never during
 * onboarding) while plan === 'trialing'. The quiet "Subscribe" link goes to the
 * existing subscription surface (Stripe Checkout) — no payment UI lives here.
 */
export function TrialBanner({ subscription, onDismiss }: Props) {
  const [loading, setLoading] = useState(false)
  const days = trialDaysRemaining(subscription)

  async function handleSubscribe() {
    setLoading(true)
    try {
      const url = await startCheckout('annual')
      window.location.href = url
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
