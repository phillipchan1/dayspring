// The screen standing between the app and the journal.
//
// Copy notes, because two words are already taken. BRANDSCRIPT bans "unlock"
// (SaaS register), and in this codebase `LockedScreen` means the subscription
// has lapsed — a completely different thing to a completely different user. So
// this screen never says either: it asks for the PIN, and the button says Open.
//
// Nothing here hints at what's behind it. No entry count, no last-written date,
// no greeting by name — a lock screen that leaks is worse than no lock screen,
// because the user believes it.
//
// It behaves like a phone's passcode screen: gold dots that fill as digits are
// typed, a try on the last digit (when the PIN's length is known), and a damped
// shake for a wrong one. A lock made before the length was stored keeps the Open
// button until its first successful open teaches it the length.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mark } from '@/components/Mark'
import { autoSubmitLength, verifyLock, type AppLockConfig } from '@/lib/appLock'
import { markResetRequested, rememberPinLength } from '@/lib/appLockStore'
import { signOut } from '@/lib/auth'
import { checkBiometry, promptBiometric, type BiometryLabel } from './biometric'
import { PinField } from './PinField'
import './AppLock.css'

/**
 * How long a wrong PIN's dots stay filled while they shake, before clearing for
 * the next try. The shake itself is `pin-field-shake` in AppLock.css.
 */
export const SHAKE_MS = 360

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function LockScreen({
  config,
  ownerId,
  onOpen,
}: {
  config: AppLockConfig
  ownerId: string
  onOpen: () => void
}) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [shake, setShake] = useState(0)
  const [biometry, setBiometry] = useState<BiometryLabel | null>(null)
  const [forgetting, setForgetting] = useState(false)
  // One automatic Face ID attempt per appearance. Without this guard the prompt
  // re-raises itself every time the effect re-runs, and a cancelled prompt
  // becomes an unclosable loop.
  const promptedRef = useRef(false)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoLength = autoSubmitLength(config)

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current)
    },
    [],
  )

  const attemptBiometric = useCallback(async () => {
    const ok = await promptBiometric('Open your journal')
    if (ok) onOpen()
  }, [onOpen])

  // Offer — and, on arrival, raise — the biometric prompt when the user opted in.
  useEffect(() => {
    if (!config.biometric) return
    let alive = true
    void (async () => {
      const status = await checkBiometry()
      if (!alive || !status.available) return
      setBiometry(status.label)
      if (promptedRef.current) return
      promptedRef.current = true
      await attemptBiometric()
    })()
    return () => {
      alive = false
    }
  }, [config.biometric, attemptBiometric])

  async function submit(candidate: string = secret) {
    if (checking || candidate.length === 0) return
    setChecking(true)
    setError(null)
    const ok = await verifyLock(config, candidate)
    if (ok) {
      onOpen()
      // An older lock learns its length from the PIN that just opened it, so
      // the next open can go on the last digit. Quietly, after the fact.
      if (config.kind === 'pin') void rememberPinLength(config, candidate.length)
      return
    }
    setError(config.kind === 'pin' ? 'That PIN doesn’t match.' : 'That doesn’t match.')
    setShake((n) => n + 1)
    // Let the filled dots shake before they empty for the next try.
    const wait = config.kind === 'pin' && !reducedMotion() ? SHAKE_MS : 0
    clearTimer.current = setTimeout(() => {
      clearTimer.current = null
      setSecret('')
      setChecking(false)
    }, wait)
  }

  // "Forgot your PIN?" — there is no secret on a server to email back, because
  // the PIN is never sent anywhere. What can prove the account is the thing that
  // already proves it: signing in again with Google or Apple. Leave the marker,
  // sign out, and the next sign-in as this same account clears the lock.
  async function startOver() {
    markResetRequested(ownerId)
    await signOut()
  }

  if (forgetting) {
    return (
      <Frame>
        <p className="applock-screen__body">
          There’s no way to look up your PIN — Dayspring never stores it. What you can
          do is sign in again with {' '}
          {/* Named generically: the account may hold either provider, or both. */}
          Google or Apple. Proving the account is yours removes the lock, and your
          journal is untouched.
        </p>
        <div className="applock-screen__actions">
          <button type="button" className="btn btn--accent applock-screen__primary" onClick={() => void startOver()}>
            Sign in again to remove the lock
          </button>
          <button type="button" className="btn btn--ghost applock-screen__quiet" onClick={() => setForgetting(false)}>
            Back
          </button>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      <p className="applock-screen__body">
        {config.kind === 'pin' ? 'Enter your PIN.' : 'Enter your passphrase.'}
      </p>

      <PinField
        kind={config.kind}
        value={secret}
        length={autoLength}
        shake={shake}
        onChange={(next) => {
          setSecret(next)
          setError(null)
          // The last digit is the Open button.
          if (autoLength && next.length === autoLength) void submit(next)
        }}
        onSubmit={() => void submit()}
        disabled={checking}
        autoFocus
        aria-label={config.kind === 'pin' ? 'PIN' : 'Passphrase'}
      />

      {/* Reserve the line so the layout doesn't jump on a wrong attempt. */}
      <p className="applock-screen__error" data-visible={error != null} role={error ? 'alert' : undefined}>
        {error ?? ' '}
      </p>

      <div className="applock-screen__actions">
        {/* Only where the screen cannot try the PIN by itself: a passphrase, or
            a lock that does not know its length yet. */}
        {!autoLength && (
          <button
            type="button"
            className="btn btn--accent applock-screen__primary"
            onClick={() => void submit()}
            disabled={secret.length === 0 || checking}
          >
            {checking ? 'Opening…' : 'Open'}
          </button>
        )}

        {biometry && (
          <button type="button" className="btn btn--ghost applock-screen__quiet" onClick={() => void attemptBiometric()}>
            Use {biometry}
          </button>
        )}

        <button
          type="button"
          className="btn btn--ghost applock-screen__quiet applock-screen__quiet--faint"
          onClick={() => setForgetting(true)}
        >
          Forgot your PIN?
        </button>
      </div>
    </Frame>
  )
}

/**
 * The shell. `.center-screen` like SignIn, plus the safe-area insets — the iOS
 * shell is 100dvh with native scrolling switched off, so anything reaching a
 * screen edge has to add those back itself or it lands under the Dynamic Island.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="center-screen applock-screen">
      <div className="applock-screen__glow" aria-hidden />
      <div className="applock-screen__inner">
        <Mark size={40} className="applock-screen__mark" />
        {children}
      </div>
    </div>
  )
}
