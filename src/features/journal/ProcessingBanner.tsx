import { useState } from 'react'
import { useProcessingJobs } from '@/hooks/useProcessingJobs'
import './ProcessingBanner.css'

/**
 * The global "your account is being prepared" signal, shown on every screen.
 *
 * Three states:
 *  - ACTIVE   → "Still preparing… N%" (× collapses it to a small pill so the
 *               signal is never lost while work runs; click the pill to re-expand).
 *  - COMPLETE → "All set 🎉" — a celebration that PERSISTS until dismissed, so a
 *               user who closed the app while it ran still learns it finished. The
 *               dismissal is remembered (localStorage, keyed to this completion)
 *               across restarts; a fresh import re-celebrates.
 *  - IDLE     → nothing.
 *
 * See docs/PROCESSING_AND_ONBOARDING.md §7.
 */
const ACK_KEY = 'dayspring.processing.ackedCompletion'

export function ProcessingBanner() {
  const { phase, overallPct, completionKey } = useProcessingJobs()
  const [collapsed, setCollapsed] = useState(false)
  const [acked, setAcked] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACK_KEY)
    } catch {
      return null
    }
  })

  // ── ACTIVE ────────────────────────────────────────────────────────────────
  if (phase === 'active') {
    if (collapsed) {
      return (
        <button
          type="button"
          className="processing-banner processing-banner--mini"
          onClick={() => setCollapsed(false)}
          title="Still preparing your reflections and altar — click for details"
          aria-label={`Still preparing — ${overallPct}% — click for details`}
        >
          <span className="processing-banner__mark" aria-hidden />
          <span className="processing-banner__pct">{overallPct}%</span>
        </button>
      )
    }
    return (
      <div className="processing-banner" role="status" aria-live="polite">
        <span className="processing-banner__mark" aria-hidden />
        <div className="processing-banner__body">
          <p className="processing-banner__text">
            Still preparing your reflections and altar — what you see so far is partial. You can keep
            writing; it fills in as it builds.
          </p>
          <div className="processing-banner__progress">
            <div className="processing-banner__bar" aria-hidden>
              <div className="processing-banner__bar-fill" style={{ width: `${overallPct}%` }} />
            </div>
            <span className="processing-banner__pct">{overallPct}%</span>
          </div>
        </div>
        <button
          type="button"
          className="processing-banner__dismiss"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse"
          title="Collapse"
        >
          ×
        </button>
      </div>
    )
  }

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (phase === 'complete' && completionKey && completionKey !== acked) {
    const ack = () => {
      try {
        localStorage.setItem(ACK_KEY, completionKey)
      } catch {
        /* private mode — at worst it re-shows next load */
      }
      setAcked(completionKey)
    }
    return (
      <div className="processing-banner processing-banner--done" role="status" aria-live="polite">
        <span className="processing-banner__mark processing-banner__mark--done" aria-hidden />
        <div className="processing-banner__body">
          <p className="processing-banner__text">
            All set — your reflections, scripture map, and altar are ready. 🎉
          </p>
        </div>
        <button
          type="button"
          className="processing-banner__dismiss"
          onClick={ack}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ×
        </button>
      </div>
    )
  }

  return null
}
