import { useEffect } from 'react'
// The trial banner's pill, and the room the shell already makes for it.
import '@/features/paywall/Paywall.css'

interface Props {
  onSignIn: () => void
  /** Dismiss for the rest of this session; it returns on the next launch. */
  onDismiss: () => void
}

/**
 * "You're signed out" — shown to a guest on a device that has had an account.
 *
 * Since writing stopped being account-gated (Guideline 5.1.1(v)), a signed-out
 * app opens straight into a local journal. For someone who has never had an
 * account that is the point. For a subscriber who was signed out without
 * asking — a revoked token, a restart after an update — it is an empty journal
 * with no explanation, and before the leave-an-account restart
 * (lib/accountLeave.ts) it was worse: their archive still showed, so nothing
 * looked wrong while nothing synced and every signed-in feature quietly did
 * nothing. One plain line, with the way back.
 *
 * Not on the writing surface: it is the same strip the trial banner uses, in
 * the room the shell already makes for it.
 */
export function SignedOutNotice({ onSignIn, onDismiss }: Props) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.trialBanner = ''
    return () => {
      delete root.dataset.trialBanner
    }
  }, [])

  return (
    <div className="trial-banner" role="status">
      <div className="trial-banner__row">
        <span>
          <span className="trial-banner__days">You’re signed out.</span> Sign in to see your journal.
        </span>
        <button type="button" className="trial-banner__action" onClick={onSignIn}>
          Sign in
        </button>
        <button type="button" className="trial-banner__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  )
}
