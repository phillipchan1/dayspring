/**
 * Shot 10 — the real lock screen, as an iPhone with Face ID shows it.
 *
 * Seeded the way `?__preview=applock` seeds it (a throwaway PIN, a token round
 * count so the page appears at once), with biometrics opted in. The capture
 * seam in `applock/biometric.ts` answers "Face ID" here, because a browser can
 * never reach the plugin that would — without it the shot would be a lock
 * screen no iPhone with Face ID has ever shown.
 */

import { useEffect, useState } from 'react'
import { LockScreen } from '@/features/applock/LockScreen'
import { createLock, type AppLockConfig } from '@/lib/appLock'
import { lockState } from '@/lib/appLockStore'

/** Three of four digits in: met mid-unlock, the field shows it is a PIN. */
const TYPED = '482'

export function LockShot() {
  const [config, setConfig] = useState<AppLockConfig | null>(null)

  useEffect(() => {
    void createLock('4821', { kind: 'pin', biometric: true, iterations: 1_000 }).then((c) => {
      lockState.seed(c)
      setConfig(c)
    })
  }, [])

  // Typed through the input's own setter and event, as a keystroke would be —
  // the field is controlled, so setting `.value` alone would be undone.
  useEffect(() => {
    if (!config) return
    const timer = window.setInterval(() => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="PIN"]')
      if (!input) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, TYPED)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.blur()
      window.clearInterval(timer)
    }, 50)
    return () => window.clearInterval(timer)
  }, [config])

  return config ? <LockScreen config={config} ownerId="listing" onOpen={() => {}} /> : null
}
