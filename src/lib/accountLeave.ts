// Leaving an account — signing out, being signed out, or another account
// taking over — restarts the app.
//
// The privacy fence (localData.ts) scrubs the cached journal when the owner
// changes, but a scrub only empties what is in the cache at that instant.
// Anything the signed-in session still had in flight — a full sync fetching
// the whole archive, a surface read, a push — finished AFTER the scrub and
// wrote the account's content straight back, where the guest shell (or the
// next account) then read it. Found on a real device, Oct 1 2026: a Mac app
// that had been signed out showed all 3,026 of its owner's pages, with the
// Altar and rollup snapshots, under a guest owner id.
//
// No list of writers to guard can be complete; a restart is. A reload ends
// every promise the old session started, and the boot fence then scrubs a
// cache nothing can refill. Account deletion has always ended this way
// (account.ts).

/** True when a signed-in account is no longer the one signed in. */
export function leftAccount(previous: string | null, current: string | null): boolean {
  return previous !== null && previous !== current
}

let claimed = false

/**
 * Said by a flow that scrubs and restarts on its own (account deletion), so
 * the general restart does not cut its scrub short.
 */
export function claimRestart(): void {
  claimed = true
}

export function restartClaimed(): boolean {
  return claimed
}
