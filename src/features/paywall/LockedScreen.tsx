import { useEffect, useState } from 'react'
import { Brand } from '@/components/Mark'
import {
  startCheckout,
  fetchPortalUrl,
  extendTrial,
  fetchJournalHolding,
  type JournalHolding,
} from '@/lib/subscription'
import type { Plan } from '@/lib/subscription'
import { exportEntriesToZip } from '@/lib/export/exportEntries'
import { submitFeedback } from '@/lib/feedback'
import './Paywall.css'

interface Props {
  plan: Plan
  /** True only while a one-time extension is still available (trialing, unused). */
  canExtend?: boolean
  onRefetch: () => void
}

export function LockedScreen({ plan, canExtend = false, onRefetch }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [holding, setHolding] = useState<JournalHolding | null>(null)
  const [exportPhase, setExportPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [exportPct, setExportPct] = useState(0)
  const [askOpen, setAskOpen] = useState(false)

  const isPastDue = plan === 'past_due'

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

  async function handleResubscribe(selectedPlan: 'annual' | 'monthly') {
    setError(null)
    setLoading(selectedPlan)
    try {
      window.location.href = await startCheckout(selectedPlan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setLoading(null)
    }
  }

  async function handleManage() {
    setError(null)
    setLoading('portal')
    try {
      window.open(await fetchPortalUrl(), '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing portal.')
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
              {loading === 'portal' ? 'Opening…' : 'Update payment method'}
            </button>
            <button className="btn btn--ghost" onClick={onRefetch} disabled={busy}>
              Already fixed? Refresh
            </button>
          </div>
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

        <h1 className="locked-screen__headline">Your journal is still here.</h1>

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
          Every word you wrote is saved. Subscribe to keep the slow work going — new reflections,
          your altar, the scripture map, all still gathering.
        </p>

        <div className="locked-screen__actions">
          <button className="btn" disabled={busy} onClick={() => void handleResubscribe('annual')}>
            {loading === 'annual' ? 'Redirecting…' : 'Continue — $64 / year'}
          </button>
          <button
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void handleResubscribe('monthly')}
          >
            {loading === 'monthly' ? 'Redirecting…' : 'Monthly — $7 / month'}
          </button>
        </div>

        <p className="locked-screen__reassure">
          Your journal is always yours — export everything, anytime, subscribed or not.
        </p>

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
        </div>

        {askOpen && <AskPhil onClose={() => setAskOpen(false)} />}

        <button className="locked-screen__refresh" onClick={onRefetch} disabled={busy}>
          Already subscribed? Refresh
        </button>

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
