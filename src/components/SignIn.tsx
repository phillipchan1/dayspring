import { useState } from 'react'
import { signInWithApple, signInWithEmail, signInWithGoogle } from '@/lib/auth'
import { Mark } from '@/components/Mark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isLightTheme } from '@/lib/resolveTheme'
import { isIOSTauri, isMobileTauri } from '@/lib/platform'
import { legalUrl } from '@/lib/legal'
import { openExternal } from '@/lib/openExternal'
import { PROVIDER_LABEL, readLastAuthProvider } from '@/lib/lastAuthProvider'
import { isOAuthCanceled, useTapAction } from '@/lib/tapAction'
import './SignIn.css'

export function SignIn() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'apple' | 'google' | 'email' | null>(null)
  // Desktop: browser is open and we're waiting on the dayspring:// callback.
  // iOS never sets this — the in-app sheet reports cancel itself.
  const [waiting, setWaiting] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
  const { settings, update } = useSettings()
  const isLight = isLightTheme(useResolvedTheme(settings))
  const showEmailSignIn = isIOSTauri()
  // Read once on mount: the value only changes on a successful sign-in, by
  // which point this screen is gone.
  const [lastProvider] = useState(readLastAuthProvider)
  // App Store guideline 4.8: when offering a third-party login (Google), Apple
  // must also be offered. On iOS we put Apple first per HIG.
  const showApple = true
  const appleFirst = isMobileTauri()
  const oauthBusy = busy === 'apple' || busy === 'google'
  const oauthProvider = busy === 'apple' || busy === 'google' ? busy : null
  const oauthLabel = oauthProvider === 'apple' ? 'Apple' : oauthProvider === 'google' ? 'Google' : null

  async function startProvider(provider: 'apple' | 'google') {
    setError(null)
    setWaiting(false)
    setBusy(provider)
    try {
      const handoff = provider === 'apple' ? await signInWithApple() : await signInWithGoogle()
      if (handoff === 'waiting-for-browser') {
        setWaiting(true)
        return
      }
    } catch (e) {
      if (!isOAuthCanceled(e)) {
        setError(e instanceof Error ? e.message : 'Sign-in failed')
      }
      setBusy(null)
      setWaiting(false)
    }
  }

  function handleSignIn(provider: 'apple' | 'google') {
    if (busy !== null && !(waiting && busy === provider)) return
    void startProvider(provider)
  }

  function handleCancelOAuth() {
    setBusy(null)
    setWaiting(false)
    setError(null)
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (busy === 'email') return
    setError(null)
    setBusy('email')
    try {
      await signInWithEmail(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setBusy(null)
    }
  }

  const appleTap = useTapAction(
    () => handleSignIn('apple'),
    busy === null || (waiting && busy === 'apple'),
  )
  const googleTap = useTapAction(
    () => handleSignIn('google'),
    busy === null || (waiting && busy === 'google'),
  )
  const emailTap = useTapAction(() => setShowEmail(true), busy !== 'email')
  const cancelTap = useTapAction(handleCancelOAuth, waiting)
  const reopenTap = useTapAction(() => {
    if (oauthProvider) handleSignIn(oauthProvider)
  }, waiting)

  function revealField(el: HTMLElement) {
    // html/body cannot scroll (position:fixed). The .signin scroller can.
    requestAnimationFrame(() => {
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    })
  }

  const appleBtn = showApple && (
    <button
      key="apple"
      type="button"
      className={`signin__btn${busy === 'apple' && !waiting ? ' signin__btn--busy' : ''}`}
      aria-busy={busy === 'apple' && !waiting}
      aria-disabled={oauthBusy && !(waiting && busy === 'apple')}
      {...appleTap}
    >
      <AppleIcon />
      {busy === 'apple' && !waiting
        ? 'Opening…'
        : waiting && busy === 'apple'
          ? 'Open again'
          : 'Continue with Apple'}
    </button>
  )

  const googleBtn = (
    <button
      key="google"
      type="button"
      className={`signin__btn${busy === 'google' && !waiting ? ' signin__btn--busy' : ''}`}
      aria-busy={busy === 'google' && !waiting}
      aria-disabled={oauthBusy && !(waiting && busy === 'google')}
      {...googleTap}
    >
      <GoogleIcon />
      {busy === 'google' && !waiting
        ? 'Opening…'
        : waiting && busy === 'google'
          ? 'Open again'
          : 'Continue with Google'}
    </button>
  )

  return (
    <div className="center-screen signin">
      <ThemeToggle
        isLight={isLight}
        onToggle={() => update({ appearance: isLight ? 'dark' : 'light' })}
        className="theme-toggle--fixed"
      />

      <div className="signin__glow" aria-hidden />

      <div className="signin__card">
        <Mark size={40} className="signin__mark" />

        <h1 className="signin__title">Dayspring</h1>

        <p className="signin__verse">the dayspring from on high</p>

        <div className="signin__rule" />

        <p className="signin__lede">A journal built for spiritual growth.</p>

        <div className="signin__actions">
          {appleFirst ? <>{appleBtn}{googleBtn}</> : <>{googleBtn}{appleBtn}</>}
        </div>

        {showEmailSignIn && (
          <div className="signin__email">
            {!showEmail ? (
              <button
                type="button"
                className="signin__btn signin__btn--secondary"
                {...emailTap}
                disabled={busy === 'email'}
              >
                Sign in with email
              </button>
            ) : (
              <form onSubmit={(e) => void handleEmailSignIn(e)} className="signin__form">
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  enterKeyHint="next"
                  autoFocus
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => revealField(e.currentTarget)}
                  disabled={busy === 'email'}
                  className="signin__input"
                />
                <div className="signin__secret">
                  <input
                    type={revealPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={(e) => revealField(e.currentTarget)}
                    disabled={busy === 'email'}
                    className="signin__input signin__input--secret"
                  />
                  <button
                    type="button"
                    className="signin__reveal"
                    aria-label={revealPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={revealPassword}
                    disabled={busy === 'email'}
                    onPointerDown={(e) => {
                      // Keep the field focused so the iOS keyboard (and paste
                      // bar) don't dismiss. Do not use useTapAction: its
                      // 500ms guard would swallow a quick hide tap.
                      e.preventDefault()
                      if (busy === 'email') return
                      if (e.button !== 0 && e.button !== -1) return
                      setRevealPassword((v) => !v)
                    }}
                  >
                    {revealPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <button
                  type="submit"
                  className="signin__btn"
                  disabled={busy === 'email' || !email.trim() || !password}
                >
                  {busy === 'email' ? 'Signing in…' : 'Continue with email'}
                </button>
              </form>
            )}
          </div>
        )}

        {oauthBusy && (
          <div className="signin__handoff">
            <p className="signin__status" role="status" aria-live="polite">
              {waiting && oauthLabel
                ? `Continue with ${oauthLabel} in your browser.`
                : `Opening ${oauthLabel ?? 'sign-in'}…`}
            </p>
            {waiting && (
              <div className="signin__recover">
                <button type="button" className="signin__recover-btn" {...reopenTap}>
                  Open again
                </button>
                <button type="button" className="signin__recover-btn" {...cancelTap}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Signing in with the other button makes a second, empty account — and
            with Apple's "Hide My Email" the two addresses never match, so
            nothing links them. A quiet reminder is the cheapest prevention. */}
        {lastProvider && (
          <p className="signin__hint">
            You continued with {PROVIDER_LABEL[lastProvider]} last time.
          </p>
        )}

        {error && (
          <p className="signin__error" role="alert">
            {error}
          </p>
        )}

        <p className="signin__legal">
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
          >
            Privacy
          </a>
        </p>
      </div>
    </div>
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

function EyeIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 004.2 4.2" />
      <path d="M9.9 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17.3 17.3 0 01-3.3 4.6" />
      <path d="M6.1 6.1C3.7 7.8 2 12 2 12s3.5 7 10 7a10.4 10.4 0 004.2-.9" />
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
