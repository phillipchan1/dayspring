import { useState } from 'react'
import { signInWithApple, signInWithGoogle, type OAuthProvider } from '@/lib/auth'
import { Mark } from '@/components/Mark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isLightTheme } from '@/lib/resolveTheme'
import { apiUrl } from '@/lib/api'
import { openExternal } from '@/lib/openExternal'
import { isTauri } from '@/lib/platform'

export function SignIn() {
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<OAuthProvider | null>(null)
  const { settings, update } = useSettings()
  const isLight = isLightTheme(useResolvedTheme(settings))

  async function handleSignIn(provider: OAuthProvider) {
    setError(null)
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    }
  }

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

        {/* Apple sits first. Guideline 4.8 requires Sign in with Apple to be no
            less prominent than the other options, and leading with it is the
            simplest way to never have that argument. */}
        <button
          onClick={() => void handleSignIn('apple')}
          onMouseEnter={() => setHovered('apple')}
          onMouseLeave={() => setHovered(null)}
          style={providerButtonStyle(hovered === 'apple')}
        >
          <AppleIcon />
          Continue with Apple
        </button>

        <button
          onClick={() => void handleSignIn('google')}
          onMouseEnter={() => setHovered('google')}
          onMouseLeave={() => setHovered(null)}
          style={providerButtonStyle(hovered === 'google')}
        >
          <GoogleIcon />
          Continue with Google
        </button>

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
          {/* apiUrl() resolves to a relative path on web and the deployed origin
              inside the native apps, so this always points at a page that exists.
              openExternal keeps Tauri from navigating its own webview away — the
              same trap documented in openExternal.ts. */}
          <a
            href={apiUrl('/privacy')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!isTauri()) return
              e.preventDefault()
              void openExternal(apiUrl('/privacy'))
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

/** Shared look for the provider buttons — identical weight for both, since
 *  Apple requires its button be no less prominent than the alternatives. */
function providerButtonStyle(hovered: boolean): React.CSSProperties {
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
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, sans-serif",
    fontSize: 13.5,
    fontWeight: 500,
    color: 'var(--accent)',
    letterSpacing: '-0.01em',
    marginBottom: 10,
    transition: 'background 0.15s, border-color 0.15s',
  }
}

function AppleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M17.05 12.54c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.79-3.12-2.03-3.8-2.06-1.62-.16-3.16.95-3.98.95-.82 0-2.09-.93-3.43-.9-1.77.02-3.4 1.03-4.31 2.61-1.84 3.19-.47 7.9 1.32 10.49.87 1.27 1.91 2.69 3.28 2.64 1.32-.05 1.81-.85 3.4-.85 1.59 0 2.03.85 3.42.82 1.41-.02 2.31-1.29 3.17-2.56.99-1.47 1.4-2.89 1.43-2.96-.03-.01-2.74-1.05-2.77-4.18M14.6 4.7c.72-.88 1.21-2.1 1.08-3.31-1.04.04-2.3.69-3.05 1.57-.67.77-1.25 2.01-1.09 3.2 1.16.09 2.34-.59 3.06-1.46"
        fill="currentColor"
      />
    </svg>
  )
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
