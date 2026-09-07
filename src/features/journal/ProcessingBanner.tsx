import { useEffect, useState } from 'react'
import { useProcessingJobs } from '@/hooks/useProcessingJobs'
import { lightEmber } from './surfaceEmbers'
import { track } from '@/lib/analytics'
import { getAckedCompletion, setAckedCompletion } from '@/lib/profile'
import './ProcessingBanner.css'

/**
 * The global "your account is being prepared" signal, shown on every screen.
 *
 * Three states:
 *  - ACTIVE   → "Still preparing… N%" (× collapses it to a small pill so the
 *               signal is never lost while work runs; click the pill to re-expand).
 *  - COMPLETE → "All set 🎉" — a celebration that PERSISTS until dismissed, so a
 *               user who closed the app while it ran still learns it finished. The
 *               dismissal is remembered account-wide (profiles.acked_processing_completion),
 *               so it stays dismissed on every device, not just this one; localStorage
 *               is only a fast-path cache for instant paint. A fresh import (newer key)
 *               re-celebrates.
 *  - IDLE     → nothing.
 *
 * See docs/PROCESSING_AND_ONBOARDING.md §7.
 */
const ACK_KEY = 'dayspring.processing.ackedCompletion'

export function ProcessingBanner({ onSeeAscent }: { onSeeAscent?: () => void }) {
  const { phase, overallPct, completionKey, etaMinutes } = useProcessingJobs()
  const [collapsed, setCollapsed] = useState(false)
  const [acked, setAcked] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACK_KEY)
    } catch {
      return null
    }
  })

  // Reconcile the local fast-path cache with the account's server-side record on
  // mount, so a completion acked on one device stays acked everywhere else too.
  useEffect(() => {
    let alive = true
    getAckedCompletion()
      .then((remote) => {
        if (!alive || !remote) return
        setAcked((cur) => (cur === remote ? cur : remote))
        try {
          localStorage.setItem(ACK_KEY, remote)
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* offline/unreachable — fall back to whatever the local cache had */
      })
    return () => {
      alive = false
    }
  }, [])

  // A finished backfill is the moment every Return surface first holds the
  // user's own material — light the one-time discovery embers (each is a no-op
  // for a surface the user has already visited).
  useEffect(() => {
    if (phase !== 'complete' || !completionKey || completionKey === acked) return
    lightEmber('reflections')
    lightEmber('scripture')
    lightEmber('altar')
  }, [phase, completionKey, acked])

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
            Building your reflections and altar from your whole journal. This runs on its own in the
            background — keep writing, close the app, walk away; it finishes regardless.
          </p>
          <div className="processing-banner__progress">
            <div className="processing-banner__bar" aria-hidden>
              <div className="processing-banner__bar-fill" style={{ width: `${overallPct}%` }} />
            </div>
            <span className="processing-banner__pct">
              {overallPct}%{etaMinutes != null ? ` · ~${etaMinutes} min left` : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="processing-banner__dismiss"
          onClick={() => setCollapsed(true)}
          aria-label="Minimize"
          title="Minimize"
        >
          −
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
      void setAckedCompletion(completionKey).catch(() => {
        /* best-effort — worst case it re-shows once on another device */
      })
    }
    return (
      <div className="processing-banner processing-banner--done" role="status" aria-live="polite">
        <span className="processing-banner__mark processing-banner__mark--done" aria-hidden />
        <div className="processing-banner__body">
          <p className="processing-banner__text">
            All set — your reflections, scripture map, and altar are ready. 🎉
          </p>
          {onSeeAscent && (
            <button
              type="button"
              className="processing-banner__cta"
              onClick={() => {
                ack()
                track('processing_cta_clicked')
                onSeeAscent()
              }}
            >
              See your Ascent →
            </button>
          )}
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
