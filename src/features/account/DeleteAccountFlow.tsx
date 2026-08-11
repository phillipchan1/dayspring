// Deleting your account, from inside the app.
//
// One component, two homes: the Settings → About danger zone, and the locked
// screen — which replaces the entire app when a subscription lapses, so without
// it the person most likely to want out would be the one person who couldn't
// reach the button.
//
// Three things this flow owes the user, in order:
//
//   1. Their writing, before it goes. The backup is offered here rather than
//      left as something they're expected to think of, because they only get
//      one chance to think of it.
//   2. The truth about the App Store. Deleting an account cannot cancel an
//      Apple subscription — Apple's API has no such call — so we say so, point
//      at the place that can, and refuse rather than quietly let the charges
//      continue. The server decides; this is the same answer, said earlier.
//   3. No accidents. Two steps, then a word typed by hand.

import { useState } from 'react'
import { deleteAccount } from '@/lib/account'
import { isAppleIapAvailable, manageAppleSubscriptions } from '@/lib/appleIap'
import { exportEntriesToZip } from '@/lib/export/exportEntries'
import { openExternal } from '@/lib/openExternal'
import { appleMayStillCharge, type Subscription } from '@/lib/subscription'

interface Props {
  /** The account being deleted, named back to the user before they confirm. */
  userEmail: string
  subscription: Subscription | null
  /**
   * Where this is rendered. The danger zone uses the settings button styles;
   * the locked screen is a row of quiet text links and would be shouted down
   * by a full-width button.
   */
  variant?: 'danger-zone' | 'link'
}

/** Typed by hand to enable the button. Trimmed and case-insensitive — phone
 *  keyboards autocapitalise, and failing someone over that is just rude. */
const CONFIRM_WORD = 'delete'

export function DeleteAccountFlow({ userEmail, subscription, variant = 'danger-zone' }: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportPhase, setExportPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [exportPct, setExportPct] = useState(0)

  // Warn before they type, not after. The server checks Apple live and is the
  // real authority; this is the same fact, in time to act on it.
  const appleStillBilling = appleMayStillCharge(subscription)
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD

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

  /** Apple's own management surface — the native sheet on device, the web page
   *  everywhere else. Same routing as billingDestination's two Apple cases. */
  async function handleManageApple() {
    setError(null)
    try {
      if (isAppleIapAvailable()) await manageAppleSubscriptions()
      else await openExternal('https://apps.apple.com/account/subscriptions')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the App Store.')
    }
  }

  async function handleDelete() {
    if (!confirmed || busy) return
    setError(null)
    setBusy(true)
    try {
      // On success this reloads the app; nothing after it runs.
      await deleteAccount()
    } catch (e) {
      // AccountDeletionBlocked included: its message is the server's own
      // wording about the store, which is the most useful thing to show.
      setError(
        e instanceof Error ? e.message : 'Something went wrong. Your account has not been deleted.',
      )
      setBusy(false)
    }
  }

  function close() {
    setOpen(false)
    setTyped('')
    setError(null)
  }

  if (!open) {
    return (
      <button
        type="button"
        className={variant === 'link' ? 'locked-soft__link' : 'btn btn--ghost'}
        onClick={() => setOpen(true)}
      >
        Delete account
      </button>
    )
  }

  return (
    <div className="delete-account">
      <div className="delete-account__title">Delete {userEmail || 'your account'}?</div>
      <p className="delete-account__body">
        This removes your journal from Dayspring — every entry and photo, and everything built
        from them: the Lamp, the Altar, the Ascent, your Concordance. It can’t be undone, and we
        can’t get it back for you afterwards.
      </p>

      <button
        type="button"
        className="btn btn--ghost delete-account__backup"
        disabled={exportPhase === 'working'}
        onClick={() => void handleExport()}
      >
        {exportPhase === 'working'
          ? `Preparing your backup… ${exportPct}%`
          : exportPhase === 'done'
            ? '✓ Backup downloaded'
            : 'Take a backup first'}
      </button>

      {appleStillBilling && (
        <div className="delete-account__notice">
          <p>
            Your subscription is billed by the App Store, and only you can stop it there —
            deleting your account here won’t. Turn off renewal first, or Apple will keep charging
            you for a journal that no longer exists.
          </p>
          <button type="button" className="btn btn--ghost" onClick={() => void handleManageApple()}>
            Manage in the App Store
          </button>
        </div>
      )}

      <label className="delete-account__field">
        <span className="delete-account__label">
          Type <strong>DELETE</strong> to confirm
        </span>
        <input
          className="delete-account__input"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Type DELETE to confirm"
        />
      </label>

      <div className="delete-account__actions">
        <button
          type="button"
          className="btn btn--danger"
          disabled={!confirmed || busy}
          onClick={() => void handleDelete()}
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>

      {error && <p className="delete-account__error">{error}</p>}
    </div>
  )
}
