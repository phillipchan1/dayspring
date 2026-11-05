import { useEffect, useState } from 'react'
import { Brand } from '@/components/Mark'
import { track } from '@/lib/analytics'
import { startCheckout } from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import {
  describeRestore,
  fetchAppleProducts,
  isAppleIapAvailable,
  purchaseApple,
  restoreApplePurchases,
  type ApplePlan,
} from '@/lib/appleIap'
import type { Product } from '@spicavi/tauri-plugin-purchases'
import { useTapAction } from '@/lib/tapAction'
import { usesAppStoreCopy } from '@/lib/storeCopy'
import { AppleSubscriptionTerms } from './AppleSubscriptionTerms'
import { displayPrice } from './prices'
import { FULL_ACCESS_SENTENCE, SERVICE_BULLETS } from './valueCopy'
import { RitualLibraryGrowth } from './RitualLibraryGrowth'
import { untilHandoffSettles } from './handoff'
import './Paywall.css'
import { haptic } from '@/lib/haptics'

export function PaywallScreen({ onPurchased }: { onPurchased?: () => void } = {}) {
  const useApple = isAppleIapAvailable()
  // Routing vs. wording are separate questions. useApple decides where the money
  // goes; this decides what we are allowed to call the first 14 days, and is the
  // wider of the two — see lib/storeCopy.ts.
  const appStoreWords = usesAppStoreCopy()
  const [loading, setLoading] = useState<'annual' | 'monthly' | 'restore' | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Non-failure feedback — e.g. "we found your old subscription, it expired". */
  const [notice, setNotice] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    track('paywall_seen', { surface: 'paywall' })
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

  async function handleSelect(plan: ApplePlan) {
    setError(null)
    setLoading(plan)
    try {
      if (useApple) {
        const { outcome, warning } = await purchaseApple(plan)
        if (outcome === 'cancelled') {
          setLoading(null)
          return
        }
        if (outcome === 'pending') {
          haptic('warning')
          setError('Purchase is pending approval. You’ll get access once it’s approved.')
          setLoading(null)
          return
        }
        if (warning) setNotice(warning)
        haptic('success')
        onPurchased?.()
        return
      }
      const url = await startCheckout(plan)
      await openExternal(url, { sameTab: true })
      // The browser has it; give the tile back once the hand-off is over.
      await untilHandoffSettles()
      setLoading(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  async function handleRestore() {
    setError(null)
    setNotice(null)
    setLoading('restore')
    try {
      const outcome = await restoreApplePurchases()
      // Always reconcile: even a non-entitling restore may have corrected the
      // recorded plan, and the server decides what happens next.
      onPurchased?.()
      const message = describeRestore(outcome)
      haptic(message?.kind === 'error' ? 'error' : 'success')
      if (message?.kind === 'error') setError(message.text)
      else if (message) setNotice(message.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore purchases.')
    } finally {
      setLoading(null)
    }
  }

  const busy = loading !== null
  // Never fall back to a hardcoded USD figure on the Apple path — App Store
  // pricing is .99-tiered ($7.99, not $7) and localised per storefront.
  const annualPrice = displayPrice('annual', { useApple, products })
  const monthlyPrice = displayPrice('monthly', { useApple, products })
  // No billed amount, no purchase: until StoreKit answers, a tile would be a
  // price-less buy button, which Guideline 3.1.2(c) does not allow.
  const annualTap = useTapAction(() => void handleSelect('annual'), !busy && annualPrice !== null)
  const monthlyTap = useTapAction(
    () => void handleSelect('monthly'),
    !busy && monthlyPrice !== null,
  )
  const restoreTap = useTapAction(() => void handleRestore(), !busy)
  // Said in the pressed tile, where the eye already is, instead of in a line of
  // its own further down. The billed amount above it stays put.
  const pendingWords = useApple ? 'Confirming with the App Store…' : 'Redirecting to checkout…'

  return (
    <div className="paywall">
      <div className="paywall__glow" aria-hidden />
      <div className="paywall__content">
        <div className="paywall__mark">
          <Brand size={34} wordmarkRem={2} />
        </div>

        {/* One layout on every platform (2026-09-21): headline, the two billed
            amounts, the disclosure. Guideline 3.1.2(c) wants the billed amount
            to be the most conspicuous pricing element, so nothing sits beside it
            — no "Best value" pill, no per-month equivalent. The only thing that
            differs by platform is whether the first 14 days are a trial of the
            purchase (web) or already granted in-app (App Store, no intro offer). */}
        <h1 className="paywall__headline">
          {appStoreWords ? 'Keep your journal with you' : 'Begin your 14-day free trial'}
        </h1>

        <div className="paywall__plans">
          <button
            type="button"
            className="paywall__plan"
            aria-disabled={busy || annualPrice === null}
            aria-busy={loading === 'annual'}
            {...annualTap}
            aria-label={`Start annual plan${annualPrice ? ` — ${annualPrice} per year` : ''}`}
          >
            <span className="paywall__plan-price">{annualPrice ?? 'Yearly'}</span>
            <span className="paywall__plan-cadence">
              {loading === 'annual' ? pendingWords : 'per year'}
            </span>
          </button>

          <button
            type="button"
            className="paywall__plan"
            aria-disabled={busy || monthlyPrice === null}
            aria-busy={loading === 'monthly'}
            {...monthlyTap}
            aria-label={`Start monthly plan${monthlyPrice ? ` — ${monthlyPrice} per month` : ''}`}
          >
            <span className="paywall__plan-price">{monthlyPrice ?? 'Monthly'}</span>
            <span className="paywall__plan-cadence">
              {loading === 'monthly' ? pendingWords : 'per month'}
            </span>
          </button>
        </div>

        {!appStoreWords && (
          <p className="paywall__trial-note">No charge for 14 days. Cancel anytime.</p>
        )}

        {/* Guideline 3.1.2(c), 2026-09-21 (build 930): two amounts and no word
            about what they buy. It sits under the tiles, in the small note
            style, so the billed amount stays the largest pricing element. */}
        {appStoreWords && (
          <>
            <p className="paywall__trial-note">Either plan is {FULL_ACCESS_SENTENCE}</p>
            <ul className="paywall__services">
              {SERVICE_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <RitualLibraryGrowth />
          </>
        )}

        {useApple && <AppleSubscriptionTerms />}

        {useApple && (
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginBottom: '0.75rem' }}
            aria-disabled={busy}
            aria-busy={loading === 'restore'}
            {...restoreTap}
          >
            {loading === 'restore' ? 'Restoring…' : 'Restore purchases'}
          </button>
        )}

        {notice && <p className="paywall__trial-note">{notice}</p>}
        {error && <p className="paywall__error">{error}</p>}
      </div>
    </div>
  )
}
