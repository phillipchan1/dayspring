// Setting, changing, and turning off the lock.
//
// One dialog, three jobs, because they share almost everything and the one place
// they differ is the important one: turning the lock OFF has to cost the PIN. A
// toggle that switches off on a tap would mean the lock protects the journal from
// everyone except the person sitting in front of the open app — which is nobody.

import { useState } from 'react'
import {
  createLock,
  validateSecret,
  verifyLock,
  type AppLockConfig,
  type AppLockKind,
} from '@/lib/appLock'
import { clearAppLock, saveAppLock } from '@/lib/appLockStore'
import { PinField } from './PinField'
import './AppLock.css'

export type SetPinMode = 'set' | 'change' | 'off'

type Step = 'current' | 'next' | 'confirm'

export function SetPinFlow({
  mode,
  config,
  biometryLabel,
  onClose,
}: {
  mode: SetPinMode
  /** The lock in force. Required for 'change' and 'off'; null when setting up. */
  config: AppLockConfig | null
  /** e.g. "Face ID" when this device offers it, so it can be opted into here. */
  biometryLabel: string | null
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>(mode === 'set' ? 'next' : 'current')
  const [kind, setKind] = useState<AppLockKind>(config?.kind ?? 'pin')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [useBiometry, setUseBiometry] = useState(config?.biometric ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const noun = kind === 'pin' ? 'PIN' : 'passphrase'

  async function submitCurrent() {
    if (!config || busy) return
    setBusy(true)
    setError(null)
    const ok = await verifyLock(config, current)
    setBusy(false)
    if (!ok) {
      setCurrent('')
      setError(`That ${config.kind === 'pin' ? 'PIN' : 'passphrase'} doesn’t match.`)
      return
    }
    if (mode === 'off') {
      await run(() => clearAppLock())
      return
    }
    setCurrent('')
    setStep('next')
  }

  function submitNext() {
    const problem = validateSecret(kind, next)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setStep('confirm')
  }

  async function submitConfirm() {
    if (confirm !== next) {
      setConfirm('')
      setError(`Those ${noun}s don’t match.`)
      return
    }
    setError(null)
    await run(async () => {
      const built = await createLock(next, {
        kind,
        // Keep whatever cadence they already chose when changing an existing
        // lock; a new one takes createLock's default.
        ...(config ? { graceSeconds: config.graceSeconds } : {}),
        biometric: biometryLabel ? useBiometry : false,
      })
      await saveAppLock(built)
    })
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch {
      setBusy(false)
      // The verifier lives on the account, so this genuinely needs the network.
      // Say that rather than "something went wrong".
      setError('Couldn’t reach your account. Check your connection and try again.')
    }
  }

  const title =
    mode === 'set' ? 'Lock Dayspring' : mode === 'change' ? `Change your ${noun}` : 'Turn off the lock'

  return (
    <div className="scrim glass-scrim applock-scrim" onClick={onClose}>
      <div
        className="applock-dialog glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-surface__glow" aria-hidden />
        <h2 className="applock-dialog__title">{title}</h2>

        {step === 'current' && (
          <>
            <p className="applock-dialog__body">
              {mode === 'off'
                ? `Enter your ${noun} to turn the lock off.`
                : `Enter your current ${noun} first.`}
            </p>
            <PinField
              kind={config?.kind ?? 'pin'}
              value={current}
              onChange={(v) => {
                setCurrent(v)
                setError(null)
              }}
              onSubmit={() => void submitCurrent()}
              disabled={busy}
              autoFocus
              aria-label={`Current ${noun}`}
            />
          </>
        )}

        {step === 'next' && (
          <>
            <p className="applock-dialog__body">
              {kind === 'pin'
                ? 'Choose 4 to 8 digits. You’ll use the same ones on your phone, your Mac, and the web.'
                : 'Choose a passphrase. You’ll use the same one on your phone, your Mac, and the web.'}
            </p>
            <PinField
              kind={kind}
              value={next}
              onChange={(v) => {
                setNext(v)
                setError(null)
              }}
              onSubmit={submitNext}
              disabled={busy}
              autoFocus
              aria-label={`New ${noun}`}
            />
            <button
              type="button"
              className="applock-dialog__switch"
              onClick={() => {
                setKind(kind === 'pin' ? 'passphrase' : 'pin')
                setNext('')
                setConfirm('')
                setError(null)
              }}
            >
              {kind === 'pin' ? 'Use a passphrase instead' : 'Use a PIN instead'}
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p className="applock-dialog__body">Enter it once more.</p>
            <PinField
              kind={kind}
              value={confirm}
              onChange={(v) => {
                setConfirm(v)
                setError(null)
              }}
              onSubmit={() => void submitConfirm()}
              disabled={busy}
              autoFocus
              aria-label={`Confirm ${noun}`}
            />
            {biometryLabel && (
              <label className="applock-dialog__opt">
                <input
                  type="checkbox"
                  checked={useBiometry}
                  onChange={(e) => setUseBiometry(e.target.checked)}
                />
                <span>
                  Open with {biometryLabel} too
                  <em>
                    A shortcut past typing it. Your {noun} still works, and you’ll
                    need it if {biometryLabel} doesn’t recognise you.
                  </em>
                </span>
              </label>
            )}
          </>
        )}

        <p className="applock-dialog__error" data-visible={error != null}>
          {error ?? ' '}
        </p>

        <div className="applock-dialog__actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              if (step === 'current') void submitCurrent()
              else if (step === 'next') submitNext()
              else void submitConfirm()
            }}
          >
            {busy ? 'Saving…' : step === 'confirm' || mode === 'off' ? 'Done' : 'Continue'}
          </button>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>

        {mode === 'set' && step === 'next' && (
          // Principle 7: be unambiguous rather than imply more privacy than we
          // deliver. This is a gate on the app, not encryption, and saying so
          // here is cheaper than being found out later.
          <p className="applock-dialog__note">
            This keeps someone who picks up your Mac or your phone out of your journal.
            It isn’t encryption — your entries are stored the same way they were
            before.
          </p>
        )}
      </div>
    </div>
  )
}
