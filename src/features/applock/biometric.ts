// Face ID as a shortcut past typing the PIN. iOS only.
//
// Two things to be clear about, because both are easy to get wrong:
//
// 1. This is a PARALLEL path to the PIN, not a cryptographic one. The plugin's
//    `authenticate()` answers yes or no; it does not hand back a secret, so
//    there is nothing to derive a verifier from. For an access gate that is
//    exactly right — but it does mean the PIN can never be retired in favour of
//    biometrics, and it must always stay reachable, because Face ID fails
//    routinely (a mask, a bad angle, a dark room).
//
// 2. `allowDeviceCredential` is deliberately OFF. Letting the device passcode
//    stand in for Face ID would mean whoever already unlocked the phone can
//    open the journal with the same passcode they just used — which is the
//    precise scenario the lock exists to prevent. Our own PIN screen is the
//    fallback, not iOS's.
//
// The label is read from the device rather than hardcoded: the ask was for
// "Face ID", but an iPad or an older phone offers Touch ID, and promising the
// wrong biometric in the UI is the kind of small lie users notice.

import { isIOSTauri } from '@/lib/platform'
import { beginExternalTrip } from '@/lib/appLockSuppress'

export type BiometryLabel = 'Face ID' | 'Touch ID' | 'biometrics'

export type BiometryStatus = {
  available: boolean
  label: BiometryLabel
}

const UNAVAILABLE: BiometryStatus = { available: false, label: 'biometrics' }

/** What this device offers, if anything. Safe to call anywhere — answers
 *  "unavailable" on web, on macOS, and whenever the plugin can't be reached. */
export async function checkBiometry(): Promise<BiometryStatus> {
  if (!isIOSTauri()) return UNAVAILABLE
  try {
    const { checkStatus, BiometryType } = await import('@tauri-apps/plugin-biometric')
    const status = await checkStatus()
    if (!status.isAvailable) return UNAVAILABLE
    const label: BiometryLabel =
      status.biometryType === BiometryType.FaceID
        ? 'Face ID'
        : status.biometryType === BiometryType.TouchID
          ? 'Touch ID'
          : 'biometrics'
    return { available: true, label }
  } catch {
    // Plugin missing from this build, or the permission isn't granted. Falling
    // back to the PIN is always correct.
    return UNAVAILABLE
  }
}

/**
 * Raise the system prompt. Resolves true only on a confirmed match.
 *
 * The prompt takes the app out of the foreground, which fires the very events
 * the lock watches — so the trip is marked first, or asking for Face ID would
 * re-lock the app underneath its own prompt.
 */
export async function promptBiometric(reason: string): Promise<boolean> {
  if (!isIOSTauri()) return false
  try {
    const { authenticate } = await import('@tauri-apps/plugin-biometric')
    beginExternalTrip()
    await authenticate(reason, {
      allowDeviceCredential: false,
      // Suppress iOS's own "Enter Password" fallback — that would be the device
      // passcode, not the Dayspring PIN. Our screen is already the fallback.
      fallbackTitle: '',
      cancelTitle: 'Use PIN',
    })
    return true
  } catch {
    // Cancelled, no match, or locked out after too many tries. Every one of
    // those means: show the PIN.
    return false
  }
}
