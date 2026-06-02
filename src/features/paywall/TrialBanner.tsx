import { useState } from 'react'
import { fetchPortalUrl, trialDaysRemaining } from '@/lib/subscription'
import type { Subscription } from '@/lib/subscription'
import './Paywall.css'

interface Props {
  subscription: Subscription
}

export function TrialBanner({ subscription }: Props) {
  const [loading, setLoading] = useState(false)
  const days = trialDaysRemaining(subscription)

  async function handleSubscribe() {
    setLoading(true)
    try {
      const url = await fetchPortalUrl()
      window.open(url, '_blank', 'noopener')
    } catch {
      // If portal isn't available (no stripe_customer_id yet), ignore — user
      // will be prompted again on the next app load.
    } finally {
      setLoading(false)
    }
  }

  const daysLabel = days === 1 ? '1 day' : `${days} days`

  return (
    <div className="trial-banner" role="status">
      <span>
        <span className="trial-banner__days">{daysLabel} remaining</span> in your free trial
      </span>
      <button
        className="trial-banner__action"
        onClick={() => void handleSubscribe()}
        disabled={loading}
      >
        {loading ? 'Loading…' : 'Subscribe to continue'}
      </button>
    </div>
  )
}
