import { useState, type CSSProperties } from 'react'
import { signInWithApple, signInWithGoogle } from '@/lib/auth'
import { Mark } from '@/components/Mark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isLightTheme } from '@/lib/resolveTheme'
import { isMobileTauri } from '@/lib/platform'
import { legalUrl } from '@/lib/legal'
import { openExternal } from '@/lib/openExternal'
import { PROVIDER_LABEL, readLastAuthProvider } from '@/lib/lastAuthProvider'

export function SignIn() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null)
  const [hovered, setHovered] = useState<'apple' | 'google' | null>(null)
  const { settings, update } = useSettings()
  const isLight = isLightTheme(useResolvedTheme(settings))
  // Read once on mount: the value only changes on a successful sign-in, by
  // which point this screen is gone.
  const [lastProvider] = useState(readLastAuthProvider)
  // App Store guideline 4.8: when offering a third-party login (Google), Apple
  // must also be offered. On iOS we put Apple first per HIG.
  const showApple = true
  const appleFirst = isMobileTauri()

  async function handleSignIn(provider: 'apple' | 'google') {
    setError(null)
    setBusy(provider)
    try {
      if (provider === 'apple') await signInWithApple()
      else await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setBusy(null)
    }
  }

  const appleBtn = showApple && (
    <button
      key="apple"
      onClick={() => void handleSignIn('apple')}
      onMouseEnter={() => setHovered('apple')}
      onMouseLeave={() => setHovered(null)}
      disabled={busy !== null}
      style={buttonStyle(hovered === 'apple', busy !== null)}
    >
      <AppleIcon />
      {busy === 'apple' ? 'Opening…' : 'Continue with Apple'}
    </button>
  )

  const googleBtn = (
    <button
      key="google"
      onClick={() => void handleSignIn('google')}
      onMouseEnter={() => setHovered('google')}
      onMouseLeave={() => setHovered(null)}
      disabled={busy !== null}
      style={buttonStyle(hovered === 'google', busy !== null)}
    >
      <GoogleIcon />
      {busy === 'google' ? 'Opening…' : 'Continue with Google'}
    </button>
  )

  return (
    <div className="center-screen" style={{ position: 'relative' }}>
      <ThemeToggle
        isLight={isLight}
        onToggle={() => update({ appearance: isLight ? 'dark' : 'light' })}
        className="theme-toggle--fixed"
      />

      {/* Ambient warm glow */}
      <div style={{
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
      }} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 340,
        width: '100%',
        padding: '0 24px',
        position: 'relative',
        zIndex: 1,
      }}>
        <Mark size={40} style={{ marginBottom: 14 }} />

        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--text-bright)',
          letterSpacing: '-0.02em',
          margin: '0 0 6px',
        }}>
          Dayspring
        </h1>

        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 12.5,
          fontStyle: 'italic',
          color: 'var(--accent)',
          opacity: 0.9,
          margin: '0 0 28px',
          letterSpacing: '0.01em',
        }}>
          the dayspring from on high
        </p>

        <div style={{
          width: 36,
          height: 0.5,
          background: 'var(--border)',
          margin: '0 auto 28px',
        }} />

        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 15,
          fontWeight: 400,
          color: 'var(--text-dim)',
          textAlign: 'center',
          lineHeight: 1.75,
          margin: '0 0 36px',
        }}>
          A journal built for spiritual growth.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          gap: 10,
          marginBottom: 16,
        }}>
          {appleFirst ? <>{appleBtn}{googleBtn}</> : <>{googleBtn}{appleBtn}</>}
        </div>

        {/* Signing in with the other button makes a second, empty account — and
            with Apple's "Hide My Email" the two addresses never match, so
            nothing links them. A quiet reminder is the cheapest prevention. */}
        {lastProvider && (
          <p style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 11.5,
            color: 'var(--text-faint)',
            textAlign: 'center',
            letterSpacing: '0.01em',
            margin: '0 0 16px',
          }}>
            You continued with {PROVIDER_LABEL[lastProvider]} last time.
          </p>
        )}

        {error && (
          <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}

        <p style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 10.5,
          color: 'var(--text-faint)',
          textAlign: 'center',
          lineHeight: 1.7,
          letterSpacing: '0.02em',
          margin: 0,
        }}>
          Your words stay private.
          {' · '}
          {/* Was hardcoded to dayspring.app/privacy — a domain that fails DNS,
              so this was a dead link on the live sign-in screen and an automatic
              App Store rejection. Now served from our own origin, opened via
              openExternal so it reaches the system browser instead of navigating
              the Tauri webview away from the app. */}
          <a
            href={legalUrl('privacy')}
            onClick={(e) => {
              e.preventDefault()
              void openExternal(legalUrl('privacy'))
            }}
            style={{
              color: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              textDecorationColor: 'var(--border)',
            }}
          >
            Privacy
          </a>
        </p>
      </div>
    </div>
  )
}

function buttonStyle(hovered: boolean, disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 260,
    padding: '11px 20px',
    borderRadius: 7,
    background: hovered
      ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
      : 'color-mix(in srgb, var(--accent) 12%, transparent)',
    border: `0.5px solid color-mix(in srgb, var(--accent) ${hovered ? 55 : 38}%, transparent)`,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    fontFamily: "'Inter', -apple-system, sans-serif",
    fontSize: 13.5,
    fontWeight: 500,
    color: 'var(--accent)',
    letterSpacing: '-0.01em',
    marginBottom: 0,
    transition: 'background 0.15s, border-color 0.15s',
  }
}

function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" fillOpacity={0.85} />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" fillOpacity={0.7} />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" fillOpacity={0.55} />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" fillOpacity={0.75} />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.422 2.21-1.18 3.03-.79.86-2.09 1.52-3.18 1.43-.14-1.1.41-2.27 1.17-3.05.79-.82 2.17-1.42 3.19-1.41zM20.75 17.34c-.58 1.34-.86 1.93-1.61 3.11-1.05 1.63-2.53 3.66-4.37 3.68-1.63.02-2.05-1.06-4.27-1.05-2.21.01-2.68 1.08-4.32 1.06-1.83-.02-3.23-1.85-4.28-3.47C-.08 16.9-.7 12.48 1.4 9.5c1.32-1.88 3.41-2.98 5.37-2.98 2.01 0 3.27 1.1 4.93 1.1 1.6 0 2.58-1.11 4.95-1.11 1.76 0 3.62.96 4.93 2.62-4.33 2.37-3.63 8.55-.83 8.21z"
      />
    </svg>
  )
}
