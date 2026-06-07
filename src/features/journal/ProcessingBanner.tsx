import { useState } from 'react'
import { useProcessingJobs } from '@/hooks/useProcessingJobs'
import './ProcessingBanner.css'

/**
 * One-time, dismissible "we're getting your account ready" banner. Shows while
 * the import backfill engine has any active job, so a freshly-imported user knows
 * their reflections / scripture map / altar are building (not broken) and can
 * start writing immediately. See docs/PROCESSING_AND_ONBOARDING.md §7.
 */
export function ProcessingBanner() {
  const { anyActive } = useProcessingJobs()
  const [dismissed, setDismissed] = useState(false)

  if (!anyActive || dismissed) return null

  return (
    <div className="processing-banner" role="status" aria-live="polite">
      <span className="processing-banner__mark" aria-hidden />
      <p className="processing-banner__text">
        We’re reading through your writing — your reflections, scripture map, and altar will fill in
        over the next few minutes. You can start writing now.
      </p>
      <button
        type="button"
        className="processing-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
