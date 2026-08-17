// "We are the reason the app just went to the background."
//
// Every hand-off Dayspring initiates — OAuth to the system browser, "Manage
// billing", and on iOS the Face ID prompt itself — backgrounds the webview and
// fires exactly the same events as the user swiping away to Messages. Without a
// way to tell those apart, the lock closes behind the user mid-sign-in, and
// worse, closes behind its own biometric prompt: tap Face ID, get the lock
// screen back.
//
// So a trip we started is marked before it starts, and the first return to the
// foreground spends the mark. The veil is unaffected — that still paints, since
// covering the window costs nothing and is right either way. This only says
// "don't ask for the PIN this once".

/** Ceiling on how long a mark stays good. A trip abandoned for this long is not
 *  a round trip any more — someone walked away, which is precisely the case the
 *  lock is for. */
const SUPPRESS_MAX_MS = 10 * 60 * 1000

let suppressedUntil = 0

/** Call immediately BEFORE handing off to the system browser, a native prompt,
 *  or anything else that will background the app on our behalf. */
export function beginExternalTrip(): void {
  suppressedUntil = Date.now() + SUPPRESS_MAX_MS
}

/** True while a trip we started is still outstanding. */
export function isExternalTripPending(): boolean {
  return suppressedUntil > Date.now()
}

/** Spend the mark. The gate calls this on every return to the foreground, so a
 *  single hand-off excuses a single return and no more. */
export function endExternalTrip(): void {
  suppressedUntil = 0
}
