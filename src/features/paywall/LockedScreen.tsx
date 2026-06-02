import { useState } from 'react'
import { Brand } from '@/components/Mark'
import { startCheckout, fetchPortalUrl } from '@/lib/subscription'
import type { Plan } from '@/lib/subscription'
import './Paywall.css'

interface Props {
  plan: Plan
  onRefetch: () => void
}

export function LockedScreen({ plan, onRefetch }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPastDue = plan === 'past_due'

  async function handleResubscribe(selectedPlan: 'annual' | 'monthly') {
    setError(null)
    setLoading(selectedPlan)
    try {
      const url = await startCheckout(selectedPlan)
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setLoading(null)
    }
  }

  async function handleManage() {
    setError(null)
    setLoading('portal')
    try {
      const url = await fetchPortalUrl()
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing portal.')
    } finally {
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <div className="locked-screen">
      <div className="locked-screen__glow" aria-hidden />
      <div className="locked-screen__content">
        <Brand size={30} wordmarkRem={1.8} />

        <h1 className="locked-screen__headline">
          {isPastDue ? 'Your payment needs attention.' : 'Your journal is still here.'}
        </h1>

        <p className="locked-screen__body">
          {isPastDue
            ? 'Your journal is right here, waiting. Update your payment method to pick up where you left off.'
            : "Everything you wrote is saved. Subscribe to keep the slow work going."}
        </p>

        <div className="locked-screen__actions">
          {isPastDue ? (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void handleManage()}
            >
              {loading === 'portal' ? 'Opening…' : 'Update payment method'}
            </button>
          ) : (
            <>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void handleResubscribe('annual')}
              >
                {loading === 'annual' ? 'Redirecting…' : 'Continue — $64 / year'}
              </button>
              <button
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => void handleResubscribe('monthly')}
              >
                {loading === 'monthly' ? 'Redirecting…' : 'Monthly — $7 / month'}
              </button>
            </>
          )}
          <button className="btn btn--ghost" onClick={onRefetch} disabled={busy}>
            Already subscribed? Refresh
          </button>
        </div>

        {error && <p className="paywall__error">{error}</p>}
      </div>
    </div>
  )
}
