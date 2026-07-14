import { useState } from 'react'
import { Brand } from '@/components/Mark'
import { startCheckout } from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import './Paywall.css'

export function PaywallScreen() {
  const [loading, setLoading] = useState<'annual' | 'monthly' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(plan: 'annual' | 'monthly') {
    setError(null)
    setLoading(plan)
    try {
      const url = await startCheckout(plan)
      await openExternal(url, { sameTab: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <div className="paywall">
      <div className="paywall__glow" aria-hidden />
      <div className="paywall__content">
        <div className="paywall__mark">
          <Brand size={34} wordmarkRem={2} />
        </div>

        <p className="paywall__tagline">the dayspring from on high.</p>

        <h1 className="paywall__headline">Begin your 14-day free trial</h1>

        <p className="paywall__sub">
          Your journal history is the whole point — everything compounds over time.
        </p>

        <div className="paywall__plans">
          <button
            className="paywall__plan"
            data-recommended="true"
            disabled={busy}
            onClick={() => void handleSelect('annual')}
            aria-label="Start annual plan — $64 per year"
          >
            <span className="paywall__plan-badge">Best value</span>
            <span className="paywall__plan-price">$64</span>
            <span className="paywall__plan-cadence">per year</span>
            <span className="paywall__plan-note">~$5.33 / month · value compounds over time</span>
          </button>

          <button
            className="paywall__plan"
            disabled={busy}
            onClick={() => void handleSelect('monthly')}
            aria-label="Start monthly plan — $7 per month"
          >
            <span className="paywall__plan-price">$7</span>
            <span className="paywall__plan-cadence">per month</span>
            <span className="paywall__plan-note">Cancel anytime</span>
          </button>
        </div>

        <p className="paywall__trial-note">
          <strong>14 days free,</strong> no charge today. Choose your plan to start — you can
          switch or cancel before the trial ends.
        </p>

        {loading && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Redirecting to checkout…
          </p>
        )}

        {error && <p className="paywall__error">{error}</p>}

      </div>
    </div>
  )
}
