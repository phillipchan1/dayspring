import { useEffect, useState } from 'react'
import { Brand } from '@/components/Mark'
import {
  startCheckout,
  billingDestination,
  fetchPortalUrl,
  extendTrial,
  fetchJournalHolding,
  isAppleRelationship,
  purchaseRoute,
  type JournalHolding,
  type Subscription,
} from '@/lib/subscription'
import type { Plan } from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import { exportEntriesToZip } from '@/lib/export/exportEntries'
import { submitFeedback } from '@/lib/feedback'
import {
  describeRestore,
  fetchAppleProducts,
  isAppleIapAvailable,
  manageAppleSubscriptions,
  purchaseApple,
  restoreApplePurchases,
} from '@/lib/appleIap'
import type { Product } from '@spicavi/tauri-plugin-purchases'
import { DeleteAccountFlow } from '@/features/account/DeleteAccountFlow'
import { AppleSubscriptionTerms } from './AppleSubscriptionTerms'
import { displayPrice } from './prices'
import './Paywall.css'

interface Props {
  plan: Plan
  /** Full subscription when available — used to pick Apple vs Stripe management. */
  subscription?: Subscription | null
  /** True only while a one-time extension is still available (trialing, unused). */
  canExtend?: boolean
  /** Signed-in account, named back to the user in the delete confirmation. */
  userEmail?: string
  onRefetch: () => void
}

export function LockedScreen({
  plan,
  subscription = null,
  canExtend = false,
  userEmail = '',
  onRefetch,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Non-failure feedback — e.g. "we found your old subscription, it expired". */
  const [notice, setNotice] = useState<string | null>(null)
  const [holding, setHolding] = useState<JournalHolding | null>(null)
  const [exportPhase, setExportPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [exportPct, setExportPct] = useState(0)
  const [askOpen, setAskOpen] = useState(false)

  // Apple terms + App Store wording apply when we're on an Apple device OR the
  // relationship lives at Apple (a lapsed App Store subscriber on the web still
  // manages it there).
  const useApple = isAppleIapAvailable() || isAppleRelationship(subscription)
  const isPastDue = plan === 'past_due'
  const isCancelled = plan === 'cancelled'

  // Where a NEW purchase goes. 'apple-elsewhere' is the only blocked case, and
  // it is far narrower than it used to be: only someone Apple is *currently*
  // billing. A cancelled App Store subscriber on the web now gets Stripe rather
  // than being told to open an iPhone they may no longer own.
  const route = purchaseRoute(subscription, { onAppleDevice: isAppleIapAvailable() })
  const manageDestination = billingDestination(subscription, {
    onAppleDevice: isAppleIapAvailable(),
  })

  useEffect(() => {
    if (isPastDue) return
    let alive = true
    fetchJournalHolding().then(
      (h) => alive && setHolding(h),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [isPastDue])

  // On iOS the price shown MUST be the one StoreKit will actually charge. It
  // differs from the web price ($7.99 vs $7 — Apple's tiers are .99 based) and
  // is localised per storefront and currency, so there is no correct hardcoded
  // fallback. displayPrice() returns null until StoreKit answers and the labels
  // below drop the figure rather than print one we'd have to break.
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    if (!isAppleIapAvailable()) return
    let alive = true
    fetchAppleProducts().then(
      (list) => alive && setProducts(list),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])

  const annualPrice = displayPrice('annual', { useApple, products })
  const monthlyPrice = displayPrice('monthly', { useApple, products })

  async function handleResubscribe(selectedPlan: 'annual' | 'monthly') {
    setError(null)
    setLoading(selectedPlan)
    try {
      switch (route) {
        case 'apple-iap': {
          const { outcome, warning } = await purchaseApple(selectedPlan)
          if (outcome === 'cancelled') {
            setLoading(null)
            return
          }
          if (outcome === 'pending') {
            setError('Purchase is pending approval. You’ll get access once it’s approved.')
            setLoading(null)
            return
          }
          if (warning) setNotice(warning)
          onRefetch()
          return
        }
        case 'apple-elsewhere':
          // Apple is still charging them — a second subscription here would be a
          // second charge nobody can refund.
          setError(
            'You already have an active App Store subscription. Manage it on your iPhone or iPad — there’s nothing to pay here.',
          )
          setLoading(null)
          return
        case 'stripe':
          await openExternal(await startCheckout(selectedPlan), { sameTab: true })
          return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setLoading(null)
    }
  }

  async function handleManage() {
    setError(null)
    setLoading('portal')
    try {
      // Billing source decides, not the device — same rule as the Billing tab.
      switch (manageDestination) {
        case 'apple-native':
          await manageAppleSubscriptions()
          return
        case 'apple-web':
          await openExternal('https://apps.apple.com/account/subscriptions')
          return
        case 'stripe':
          await openExternal(await fetchPortalUrl())
          return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing portal.')
    } finally {
      setLoading(null)
    }
  }

  async function handleRestore() {
    setError(null)
    setNotice(null)
    setLoading('restore')
    try {
      const outcome = await restoreApplePurchases()
      // Always refetch: even a non-entitling restore may have corrected the
      // recorded plan, and the server is the authority on what happens next.
      onRefetch()
      const message = describeRestore(outcome)
      if (message?.kind === 'error') setError(message.text)
      else if (message) setNotice(message.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore purchases.')
    } finally {
      setLoading(null)
    }
  }

  async function handleExtend() {
    setError(null)
    setLoading('extend')
    try {
      await extendTrial()
      onRefetch() // trial_ends_at is now in the future → re-enters the app
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extend the trial.')
      setLoading(null)
    }
  }

  async function handleExport() {
    setError(null)
    setExportPct(0)
    setExportPhase('working')
    try {
      const blob = await exportEntriesToZip((fetched, total) => {
        if (total > 0) setExportPct(Math.round((fetched / total) * 100))
      })
      const date = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dayspring-backup-${date}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
      setExportPhase('idle')
    }
  }

  const busy = loading !== null

  // ── Past-due: simpler "fix your card" screen ──────────────────────────────
  if (isPastDue) {
    return (
      <div className="locked-screen">
        <div className="locked-screen__glow" aria-hidden />
        <div className="locked-screen__content">
          <Brand size={30} wordmarkRem={1.8} />
          <h1 className="locked-screen__headline">Your payment needs attention.</h1>
          <p className="locked-screen__body">
            Your journal is right here, waiting. Update your payment method to pick up where you
            left off.
          </p>
          <div className="locked-screen__actions">
            <button className="btn" disabled={busy} onClick={() => void handleManage()}>
              {loading === 'portal'
                ? 'Opening…'
                : // Follow where the money actually is, not the device in hand —
                  // labelling a Stripe subscriber's button "Manage in App Store"
                  // sends them hunting for a subscription that isn't there.
                  manageDestination === 'stripe'
                  ? 'Update payment method'
                  : 'Manage in App Store'}
            </button>
            <button className="btn btn--ghost" onClick={onRefetch} disabled={busy}>
              Already fixed? Refresh
            </button>
          </div>
          {notice && <p className="locked-screen__reassure">{notice}</p>}
          {error && <p className="paywall__error">{error}</p>}
        </div>
      </div>
    )
  }

  // ── Trial ended ───────────────────────────────────────────────────────────
  return (
    <div className="locked-screen">
      <div className="locked-screen__glow" aria-hidden />
      <div className="locked-screen__content">
        <Brand size={30} wordmarkRem={1.8} />

        <h1 className="locked-screen__headline">
          {isCancelled ? 'Your journal is still here.' : 'Your trial has ended.'}
        </h1>

        {holding && holding.entries > 0 && (
          <div className="locked-holding" aria-label="What Dayspring is holding for you">
            <span className="locked-holding__lead">Dayspring is holding</span>
            <div className="locked-holding__stats">
              <Stat n={holding.entries} label={holding.entries === 1 ? 'entry' : 'entries'} />
              {holding.years > 0 && (
                <Stat n={holding.years} label={holding.years === 1 ? 'year' : 'years'} />
              )}
              {holding.prayers > 0 && (
                <Stat n={holding.prayers} label={holding.prayers === 1 ? 'prayer' : 'prayers'} />
              )}
              {holding.scriptures > 0 && <Stat n={holding.scriptures} label="scriptures" />}
            </div>
          </div>
        )}

        <p className="locked-screen__body">
          {isCancelled
            ? 'You cancelled, but everything you wrote is still here. Come back whenever you\'re ready.'
            : 'Every word you wrote is saved. Subscribe to keep the slow work going — new reflections, your altar, the scripture map, all still gathering.'}
        </p>

        <div className="locked-screen__actions">
          <button className="btn" disabled={busy} onClick={() => void handleResubscribe('annual')}>
            {loading === 'annual'
              ? isAppleIapAvailable()
                ? 'Confirming…'
                : 'Redirecting…'
              : annualPrice
                ? `Continue — ${annualPrice} / year`
                : 'Continue yearly'}
          </button>
          <button
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void handleResubscribe('monthly')}
          >
            {loading === 'monthly'
              ? isAppleIapAvailable()
                ? 'Confirming…'
                : 'Redirecting…'
              : monthlyPrice
                ? `Monthly — ${monthlyPrice} / month`
                : 'Monthly'}
          </button>
          {isAppleIapAvailable() && (
            <button
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void handleRestore()}
            >
              {loading === 'restore' ? 'Restoring…' : 'Restore purchases'}
            </button>
          )}
        </div>

        <p className="locked-screen__reassure">
          Your journal is always yours — export everything, anytime, subscribed or not.
        </p>

        {useApple && <AppleSubscriptionTerms />}

        <div className="locked-soft">
          {canExtend && (
            <button
              type="button"
              className="locked-soft__link"
              disabled={busy}
              onClick={() => void handleExtend()}
            >
              {loading === 'extend' ? 'One moment…' : 'Not ready? Take another week'}
            </button>
          )}
          <button
            type="button"
            className="locked-soft__link"
            disabled={exportPhase === 'working'}
            onClick={() => void handleExport()}
          >
            {exportPhase === 'working'
              ? `Preparing your backup… ${exportPct}%`
              : exportPhase === 'done'
                ? '✓ Backup downloaded'
                : 'Download my journal'}
          </button>
          <button type="button" className="locked-soft__link" onClick={() => setAskOpen((o) => !o)}>
            Questions?
          </button>
          {/* This screen replaces the whole app while a subscription is lapsed,
              Settings included — so without this the one person most likely to
              want out would be the one who couldn't reach the button. */}
          <DeleteAccountFlow userEmail={userEmail} subscription={subscription} variant="link" />
        </div>

        {askOpen && <AskPhil onClose={() => setAskOpen(false)} />}

        <button className="locked-screen__refresh" onClick={onRefetch} disabled={busy}>
          {isCancelled ? 'Just resubscribed? Refresh' : 'Already subscribed? Refresh'}
        </button>

        {notice && <p className="locked-screen__reassure">{notice}</p>}
        {error && <p className="paywall__error">{error}</p>}
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="locked-holding__stat">
      <span className="locked-holding__num">{n.toLocaleString()}</span>
      <span className="locked-holding__lbl">{label}</span>
    </span>
  )
}

/** A quiet, human line to the maker — routed through the in-app feedback channel
 *  (not a raw mailto), so it's warm without inviting spam. */
function AskPhil({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    if (!msg.trim()) return
    setState('sending')
    try {
      await submitFeedback(msg.trim(), 'question')
      setState('sent')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="locked-ask locked-ask--sent">
        <p>Got it — I read these myself and I’ll get back to you. Thank you. — Phil</p>
        <button type="button" className="locked-soft__link" onClick={onClose}>
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="locked-ask">
      <p className="locked-ask__lead">
        A real person made Dayspring. If something’s holding you back — privacy, cost, what happens
        if you cancel — ask me directly.
      </p>
      <textarea
        className="locked-ask__field"
        rows={3}
        placeholder="Your question…"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        autoFocus
      />
      <div className="locked-ask__row">
        <button
          type="button"
          className="btn btn--ghost locked-ask__send"
          disabled={state === 'sending' || !msg.trim()}
          onClick={() => void send()}
        >
          {state === 'sending' ? 'Sending…' : 'Send to Phil'}
        </button>
        {state === 'error' && <span className="paywall__error">Didn’t send — try again.</span>}
      </div>
    </div>
  )
}
