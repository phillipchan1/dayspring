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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mark } from '@/components/Mark'
import { verifyLock, type AppLockConfig } from '@/lib/appLock'
import { markResetRequested } from '@/lib/appLockStore'
import { signOut } from '@/lib/auth'
import { checkBiometry, promptBiometric, type BiometryLabel } from './biometric'
import { PinField } from './PinField'

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
  const [biometry, setBiometry] = useState<BiometryLabel | null>(null)
  const [forgetting, setForgetting] = useState(false)
  // One automatic Face ID attempt per appearance. Without this guard the prompt
  // re-raises itself every time the effect re-runs, and a cancelled prompt
  // becomes an unclosable loop.
  const promptedRef = useRef(false)

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

  async function submit() {
    if (checking || secret.length === 0) return
    setChecking(true)
    setError(null)
    const ok = await verifyLock(config, secret)
    if (ok) {
      onOpen()
      return
    }
    setChecking(false)
    setSecret('')
    setError(config.kind === 'pin' ? 'That PIN doesn’t match.' : 'That doesn’t match.')
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
        <p style={bodyText}>
          There’s no way to look up your PIN — Dayspring never stores it. What you can
          do is sign in again with {' '}
          {/* Named generically: the account may hold either provider, or both. */}
          Google or Apple. Proving the account is yours removes the lock, and your
          journal is untouched.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center' }}>
          <button style={primaryButton} onClick={() => void startOver()}>
            Sign in again to remove the lock
          </button>
          <button style={quietButton} onClick={() => setForgetting(false)}>
            Back
          </button>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      <p style={bodyText}>
        {config.kind === 'pin' ? 'Enter your PIN.' : 'Enter your passphrase.'}
      </p>

      <PinField
        kind={config.kind}
        value={secret}
        onChange={(next) => {
          setSecret(next)
          setError(null)
        }}
        onSubmit={() => void submit()}
        disabled={checking}
        autoFocus
        aria-label={config.kind === 'pin' ? 'PIN' : 'Passphrase'}
      />

      {/* Reserve the line so the layout doesn't jump on a wrong attempt. */}
      <p style={{ ...errorText, visibility: error ? 'visible' : 'hidden' }}>
        {error ?? ' '}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center' }}>
        <button
          style={{ ...primaryButton, opacity: secret.length === 0 || checking ? 0.5 : 1 }}
          onClick={() => void submit()}
          disabled={secret.length === 0 || checking}
        >
          {checking ? 'Opening…' : 'Open'}
        </button>

        {biometry && (
          <button style={quietButton} onClick={() => void attemptBiometric()}>
            Use {biometry}
          </button>
        )}

        <button style={{ ...quietButton, opacity: 0.7 }} onClick={() => setForgetting(true)}>
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
    <div
      className="center-screen"
      style={{
        position: 'relative',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      <div
        style={{
          position: 'fixed',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,145,60,0.05) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -55%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 340,
          width: '100%',
          padding: '0 24px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Mark size={40} style={{ marginBottom: 18 }} />
        {children}
      </div>
    </div>
  )
}

const bodyText: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 15,
  color: 'var(--text-dim)',
  textAlign: 'center',
  lineHeight: 1.75,
  margin: '0 0 22px',
}

const errorText: React.CSSProperties = {
  fontFamily: "'Inter', -apple-system, sans-serif",
  fontSize: 12,
  color: 'var(--danger)',
  textAlign: 'center',
  margin: '10px 0 14px',
  minHeight: '1em',
}

const primaryButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  maxWidth: 260,
  padding: '11px 20px',
  borderRadius: 7,
  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
  border: '0.5px solid color-mix(in srgb, var(--accent) 38%, transparent)',
  cursor: 'pointer',
  fontFamily: "'Inter', -apple-system, sans-serif",
  fontSize: 13.5,
  fontWeight: 500,
  color: 'var(--accent)',
  letterSpacing: '-0.01em',
}

const quietButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: "'Inter', -apple-system, sans-serif",
  fontSize: 12,
  color: 'var(--text-faint)',
  letterSpacing: '0.01em',
  padding: '6px 8px',
}
