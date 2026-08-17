import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LockScreen } from './LockScreen'
import { SetPinFlow, type SetPinMode } from './SetPinFlow'
import { AppLockSettings } from './AppLockSettings'
import { createLock } from '@/lib/appLock'
import { lockState } from '@/lib/appLockStore'
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from '@/lib/resolveTheme'

/**
 * Dev-only standalone rendering of the app-lock surfaces.
 *
 * These screens sit *behind* OAuth by definition — you can't reach the lock
 * screen without an account that has a lock on it — so the alternative to this
 * is signing in against real data and setting a real PIN on a real profile every
 * time the copy or the layout changes. The same reasoning as the paywall preview
 * next door, and the same mechanism.
 *
 * Reached only via `?__preview=applock…` behind `import.meta.env.DEV`, so Vite
 * strips the whole path (and this module) out of production bundles.
 *
 *   ?__preview=applock          → the lock screen, PIN
 *   ?__preview=applock-phrase   → the lock screen, passphrase
 *   ?__preview=applock-faceid   → the lock screen with biometrics opted in.
 *                                 The "Use Face ID" button does NOT appear in a
 *                                 browser and shouldn't: checkBiometry() answers
 *                                 "unavailable" off iOS. This variant is here to
 *                                 exercise the auto-prompt path, which must
 *                                 no-op rather than throw. Verify the button on
 *                                 the simulator.
 *   ?__preview=applock-set      → the set-a-PIN dialog
 *   ?__preview=applock-off      → the turn-it-off dialog (asks for the PIN)
 *   ?__preview=applock-settings → the Privacy rows in Settings
 *
 * Append `&light` for the light palette.
 *
 * The PIN in every variant is 4821.
 */
export async function renderAppLockPreview(variant: string): Promise<void> {
  const light = new URLSearchParams(window.location.search).has('light')
  const root = document.documentElement
  root.setAttribute('data-theme', light ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME)
  root.setAttribute('data-appearance', light ? 'light' : 'dark')
  root.style.colorScheme = light ? 'light' : 'dark'

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  const kind = variant === 'applock-phrase' ? 'passphrase' : 'pin'
  const config = await createLock(kind === 'pin' ? '4821' : 'dayspring', {
    kind,
    biometric: variant === 'applock-faceid',
    // The preview re-creates this on every reload and nothing verifies against
    // it in anger; the shipping round count just makes the page slow to appear.
    iterations: 1_000,
  })
  lockState.seed(config)

  createRoot(el).render(<Preview variant={variant} />)

  function Preview({ variant }: { variant: string }) {
    const [opened, setOpened] = useState(false)

    if (variant === 'applock-settings') {
      return (
        <div className="settings-main__body" style={{ maxWidth: 520, margin: '3rem auto' }}>
          <div className="settings-about__section">
            <div className="settings-about__section-title">Privacy</div>
            <div className="settings-about__group">
              <AppLockSettings />
            </div>
          </div>
        </div>
      )
    }

    if (variant === 'applock-set' || variant === 'applock-off') {
      const mode: SetPinMode = variant === 'applock-set' ? 'set' : 'off'
      return (
        <SetPinFlow
          mode={mode}
          config={mode === 'off' ? config : null}
          biometryLabel="Face ID"
          onClose={() => {}}
        />
      )
    }

    if (opened) {
      return (
        <div className="center-screen">
          <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-dim)' }}>
            Opened. (The journal would be here.)
          </p>
        </div>
      )
    }

    return <LockScreen config={config} ownerId="preview-owner" onOpen={() => setOpened(true)} />
  }
}
