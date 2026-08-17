// Settings → About → Privacy: the whole app-lock surface in one component, so
// the 40KB SettingsPanel gains a single line rather than another hundred.
//
// The toggle reads its state from the shared lock store rather than from
// `Settings`. Settings sync is a whole-object, last-writer-wins push (see
// useSettingsSync) — a second device holding a stale blob would push the lock
// back off, which is a security control disabled by a race. So the lock lives in
// its own column with its own reads and writes, and this row reflects that.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { GRACE_CHOICES, type AppLockConfig } from '@/lib/appLock'
import { lockState, saveAppLock } from '@/lib/appLockStore'
import { checkBiometry } from './biometric'
import { SetPinFlow, type SetPinMode } from './SetPinFlow'
import { APP_LOCK_ENABLED } from './flags'

export function AppLockSettings() {
  const config = useSyncExternalStore(lockState.subscribe, lockState.get, lockState.get)
  const [flow, setFlow] = useState<SetPinMode | null>(null)
  const [biometryLabel, setBiometryLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void checkBiometry().then((status) => {
      if (alive) setBiometryLabel(status.available ? status.label : null)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!APP_LOCK_ENABLED) return null

  const on = config != null
  const noun = config?.kind === 'passphrase' ? 'passphrase' : 'PIN'

  /**
   * Re-save the verifier with one field changed.
   *
   * The salt and hash are carried through untouched: changing how often the lock
   * asks, or whether Face ID may answer for it, must not silently invalidate the
   * PIN the user set — on this device or on the other one syncing from the same
   * row.
   */
  async function patch(changes: Partial<Pick<AppLockConfig, 'graceSeconds' | 'biometric'>>) {
    if (!config) return
    setError(null)
    try {
      await saveAppLock({ ...config, ...changes, updatedAt: new Date().toISOString() })
    } catch {
      setError('Couldn’t save that. Check your connection and try again.')
    }
  }

  return (
    <>
      <div className="settings-about__row-toggle">
        <label className="settings-toggle">
          <span>
            <span className="settings-field__label">Lock Dayspring</span>
            <span className="settings-toggle__hint">
              Asks for a {noun} before your journal opens. The same one works on your
              Mac, your phone, and the web.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Lock Dayspring"
            className="switch"
            data-on={on}
            // Turning it OFF goes through the same dialog as turning it on,
            // because switching it off has to cost the PIN. Otherwise the lock
            // guards the journal from everyone except whoever is sitting in
            // front of the already-open app.
            onClick={() => setFlow(on ? 'off' : 'set')}
          >
            <span className="switch__thumb" />
          </button>
        </label>
      </div>

      {on && config && (
        <>
          <div className="settings-about__row">
            <span className="settings-field__label">Ask for it</span>
            <select
              className="settings-select"
              style={{ width: 'auto', maxWidth: '13rem' }}
              value={String(config.graceSeconds)}
              onChange={(e) => void patch({ graceSeconds: Number(e.target.value) })}
            >
              {GRACE_CHOICES.map((choice) => (
                <option key={choice.seconds} value={String(choice.seconds)}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>

          {biometryLabel && (
            <div className="settings-about__row-toggle">
              <label className="settings-toggle">
                <span>
                  <span className="settings-field__label">Open with {biometryLabel}</span>
                  <span className="settings-toggle__hint">
                    A shortcut past typing your {noun} — which still works, and which
                    you’ll need if {biometryLabel} doesn’t recognise you.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.biometric}
                  aria-label={`Open with ${biometryLabel}`}
                  className="switch"
                  data-on={config.biometric}
                  onClick={() => void patch({ biometric: !config.biometric })}
                >
                  <span className="switch__thumb" />
                </button>
              </label>
            </div>
          )}

          <div className="settings-about__row">
            <span className="settings-field__label">Your {noun}</span>
            <button className="btn btn--ghost" onClick={() => setFlow('change')}>
              Change
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="settings-about__row">
          <span className="settings-field__value" style={{ color: 'var(--danger)' }}>
            {error}
          </span>
        </div>
      )}

      {flow && (
        <SetPinFlow
          mode={flow}
          config={config ?? null}
          biometryLabel={biometryLabel}
          onClose={() => setFlow(null)}
        />
      )}
    </>
  )
}
