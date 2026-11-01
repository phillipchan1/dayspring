// Setting, changing, and turning off the lock.
//
// One dialog, three jobs, because they share almost everything and the one place
// they differ is the important one: turning the lock OFF has to cost the PIN. A
// toggle that switches off on a tap would mean the lock protects the journal from
// everyone except the person sitting in front of the open app — which is nobody.

import { useEffect, useRef, useState } from 'react'
import {
  autoSubmitLength,
  createLock,
  validateSecret,
  verifyLock,
  type AppLockConfig,
  type AppLockKind,
} from '@/lib/appLock'
import { clearAppLock, saveAppLock } from '@/lib/appLockStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useExit, useMergedRef } from '@/hooks/usePresence'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import { useVisualViewportFrame } from '@/hooks/useViewportHeight'
import { PinField } from './PinField'
import './AppLock.css'

/**
 * Esc cancels the dialog — and only the dialog.
 *
 * It opens over Settings, whose own Esc handler is a window capture listener
 * registered when Settings mounts; listeners on one target run in the order
 * they were added, so a listener this dialog added on mount would always run
 * second, after Settings had already closed itself and this with it. So the
 * listener is added once, when this module loads — before any Settings has
 * mounted — and claims the key (stopImmediatePropagation) only while a dialog
 * is open.
 */
let cancelOpenDialog: (() => void) | null = null
if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !cancelOpenDialog) return
      e.preventDefault()
      e.stopImmediatePropagation()
      cancelOpenDialog()
    },
    true,
  )
}

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
  const [shake, setShake] = useState(0)

  const noun = kind === 'pin' ? 'PIN' : 'passphrase'

  // Every way out plays the exit first (useExit): the sheet goes back down,
  // the dialog fades. The parent only hears once it has gone.
  const exit = useExit(onClose)
  const close = exit.close

  // On a phone this is a sheet from the bottom edge, pulled down to cancel; on
  // a Mac or an iPad it stays the centred dialog.
  const isSheet = useIsMobile()
  const sheet = useSheetDismiss({ onDismiss: close, enabled: isSheet && !busy && !exit.closing })
  const dialogRef = useMergedRef<HTMLDivElement>(exit.ref, sheet.ref)
  // The keyboard is up the whole time (the field is focused), and a fixed
  // overlay on iOS is pinned to the layout viewport, not the visible one — so
  // the sheet's ground follows the visible area and the sheet rests on the keys.
  const frame = useVisualViewportFrame()

  const closeRef = useRef(close)
  closeRef.current = close
  const busyRef = useRef(busy)
  busyRef.current = busy
  useEffect(() => {
    const cancel = () => {
      if (!busyRef.current) closeRef.current()
    }
    cancelOpenDialog = cancel
    return () => {
      if (cancelOpenDialog === cancel) cancelOpenDialog = null
    }
  }, [])

  async function submitCurrent(candidate: string = current) {
    if (!config || busy) return
    setBusy(true)
    setError(null)
    const ok = await verifyLock(config, candidate)
    setBusy(false)
    if (!ok) {
      setCurrent('')
      setShake((n) => n + 1)
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

  async function submitConfirm(candidate: string = confirm) {
    if (busy) return
    if (candidate !== next) {
      setConfirm('')
      setShake((n) => n + 1)
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
      close()
    } catch {
      setBusy(false)
      // The verifier lives on the account, so this genuinely needs the network.
      // Say that rather than "something went wrong".
      setError('Couldn’t reach your account. Check your connection and try again.')
    }
  }

  const title =
    mode === 'set' ? 'Lock Dayspring' : mode === 'change' ? `Change your ${noun}` : 'Turn off the lock'

  // Where the PIN's length is already known, the last digit moves on by
  // itself — the current PIN (if the lock knows it), and the confirmation,
  // which can only be as long as the PIN just chosen.
  const currentLength = config ? autoSubmitLength(config) : null
  const confirmLength = kind === 'pin' ? next.length : null

  return (
    <div
      className={`scrim glass-scrim applock-scrim${isSheet ? ' applock-scrim--sheet' : ''}`}
      style={isSheet && frame ? { top: frame.top, height: frame.height, bottom: 'auto' } : undefined}
      data-state={exit.state}
      onClick={close}
    >
      <div
        ref={dialogRef}
        className={`applock-dialog glass-surface${isSheet ? ' applock-dialog--sheet' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-state={exit.state}
        data-dragging={sheet.dragging || undefined}
        onClick={(e) => e.stopPropagation()}
        {...sheet.handlers}
      >
        <div className="glass-surface__glow" aria-hidden />
        {isSheet && <div className="applock-dialog__grabber" aria-hidden />}
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
              length={currentLength}
              shake={shake}
              onChange={(v) => {
                setCurrent(v)
                setError(null)
                if (currentLength && v.length === currentLength) void submitCurrent(v)
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
              length={confirmLength}
              shake={shake}
              onChange={(v) => {
                setConfirm(v)
                setError(null)
                // With Face ID still to decide, the last digit only fills the
                // dots; Done is the decision.
                if (confirmLength && v.length === confirmLength && !biometryLabel) void submitConfirm(v)
              }}
              onSubmit={() => void submitConfirm()}
              disabled={busy}
              autoFocus
              aria-label={`Confirm ${noun}`}
            />
            {biometryLabel && (
              // The same switch as the Face ID row in Settings, not a raw
              // checkbox: it is the same setting.
              <div className="applock-dialog__opt">
                <span className="applock-dialog__opt-text" id="applock-biometry-label">
                  Open with {biometryLabel} too
                  <em>
                    A shortcut past typing it. Your {noun} still works, and you’ll
                    need it if {biometryLabel} doesn’t recognise you.
                  </em>
                </span>
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={useBiometry}
                  aria-labelledby="applock-biometry-label"
                  data-on={useBiometry}
                  onClick={() => setUseBiometry((v) => !v)}
                >
                  <span className="switch__thumb" />
                </button>
              </div>
            )}
          </>
        )}

        <p className="applock-dialog__error" data-visible={error != null}>
          {error ?? ' '}
        </p>

        <div className="applock-dialog__actions">
          <button
            type="button"
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
          <button type="button" className="btn btn--ghost" onClick={close} disabled={busy}>
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
