import { useState } from 'react'
import { useProcessingJobs } from '@/hooks/useProcessingJobs'
import './ProcessingBanner.css'

/**
 * "Still preparing your account" signal, shown on every screen while the import
 * backfill engine has any active job — so a partially-built surface never reads
 * as done. The × COLLAPSES it to a small pill (it never fully dismisses while
 * work is running, or the user loses the only progress signal); clicking the
 * pill re-expands it. Both vanish once everything's built.
 * See docs/PROCESSING_AND_ONBOARDING.md §7.
 */
export function ProcessingBanner() {
  const { anyActive, overallPct } = useProcessingJobs()
  const [collapsed, setCollapsed] = useState(false)

  if (!anyActive) return null

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
