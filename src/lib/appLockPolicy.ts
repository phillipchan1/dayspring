// When the app lock should demand the secret again.
//
// Pure and separate from the gate component on purpose: this is the part most
// likely to be subtly wrong, and every way of getting it wrong is bad in one
// direction or the other. Too eager and the app asks for a PIN when the user
// steps back in from the Face ID prompt it just raised itself; too lax and the
// journal sits open on a laptop somebody else is now using.
//
// Note what this deliberately does NOT decide: whether to paint the veil. The
// veil goes up whenever the app isn't frontmost, no grace period, no exceptions
// — that's what keeps entry text out of the macOS window preview and the iOS
// app-switcher card. This function only answers the narrower question of
// whether coming back should cost the user their PIN.

import { GRACE_ONLY_ON_LAUNCH, type AppLockConfig } from './appLock'

export type LockDecisionInput = {
  /** null when the lock is off — nothing to demand. */
  config: AppLockConfig | null
  /** True for the first evaluation after the app process started. */
  coldStart: boolean
  /** When the app last went to the background, or null if it hasn't. */
  hiddenAtMs: number | null
  nowMs: number
  /**
   * True when the trip out of the app was one we started ourselves: an OAuth
   * hand-off to the system browser, "Manage billing", the photo picker, the mic
   * permission sheet — or the Face ID prompt, which backgrounds the webview
   * exactly like the others. Without this the lock slams shut underneath its
   * own biometric prompt.
   */
  suppressed: boolean
}

/**
 * Should the lock screen be showing?
 *
 * Cold start beats everything: a fresh launch always asks, which is the case
 * the whole feature exists for. After that, suppression wins, then the
 * only-on-launch setting, then the grace period.
 */
export function shouldLock(input: LockDecisionInput): boolean {
  const { config, coldStart, hiddenAtMs, nowMs, suppressed } = input

  if (!config) return false
  if (coldStart) return true
  if (suppressed) return false
  if (config.graceSeconds === GRACE_ONLY_ON_LAUNCH) return false
  if (hiddenAtMs === null) return false

  const awayMs = nowMs - hiddenAtMs
  // Clock moved backwards — a timezone change, an NTP correction, or a user
  // who set the date back to cheat the timer. We can't tell how long they were
  // really gone, so fail closed and ask.
  if (awayMs < 0) return true

  return awayMs >= config.graceSeconds * 1000
}
